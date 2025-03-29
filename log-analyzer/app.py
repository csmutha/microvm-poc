import os
import json
import time
import logging
import yaml
import requests
import google.generativeai as genai
from flask import Flask, request, jsonify
from kubernetes import client, config
from prometheus_client import start_http_server, Counter, Gauge
from fluent import sender
from pythonjsonlogger import jsonlogger

# Configure logging
logger = logging.getLogger()
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(message)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# Initialize Flask app
app = Flask(__name__)

# Initialize Prometheus metrics
ERROR_COUNTER = Counter('log_analyzer_errors_total', 'Total number of errors analyzed')
ACTION_COUNTER = Counter('log_analyzer_actions_total', 'Total number of actions taken', ['action_type'])
RESPONSE_TIME = Gauge('log_analyzer_llm_response_time_seconds', 'Response time of LLM API calls')

# Configure Gemini API
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY environment variable not set")
    raise ValueError("GEMINI_API_KEY environment variable not set")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-pro')

# Initialize Kubernetes client
try:
    config.load_incluster_config()
    k8s_api = client.CoreV1Api()
    k8s_apps_api = client.AppsV1Api()
    logger.info("Kubernetes client initialized in-cluster")
except:
    try:
        config.load_kube_config()
        k8s_api = client.CoreV1Api()
        k8s_apps_api = client.AppsV1Api()
        logger.info("Kubernetes client initialized from kube config")
    except:
        logger.warning("Failed to initialize Kubernetes client, VM management will be disabled")
        k8s_api = None
        k8s_apps_api = None

# Initialize Fluentd sender
FLUENTD_HOST = os.environ.get('FLUENTD_HOST', 'fluentd')
FLUENTD_PORT = int(os.environ.get('FLUENTD_PORT', '24224'))
fluent_sender = sender.FluentSender('log-analyzer', host=FLUENTD_HOST, port=FLUENTD_PORT)

# Namespace for our services
NAMESPACE = os.environ.get('NAMESPACE', 'microvm-poc')

def analyze_logs_with_llm(logs):
    """
    Send logs to Gemini for analysis and get recommended actions
    """
    start_time = time.time()
    
    prompt = f"""
    You are an expert system administrator and software engineer. Analyze these logs and identify any errors or issues:
    
    {logs}
    
    Provide your analysis in the following JSON format:
    {{
        "error_detected": true/false,
        "error_type": "one of: code_error, system_error, resource_error, network_error, unknown",
        "severity": "one of: low, medium, high, critical",
        "description": "detailed description of the error",
        "recommended_action": "one of: restart_service, update_code, increase_resources, no_action",
        "service_name": "name of the affected service",
        "code_fix": "if code_error, provide the fix here or null"
    }}
    
    Only respond with valid JSON. No other text.
    """
    
    try:
        response = model.generate_content(prompt)
        response_time = time.time() - start_time
        RESPONSE_TIME.set(response_time)
        
        # Extract JSON from response
        try:
            result = json.loads(response.text)
            logger.info(f"LLM analysis completed in {response_time:.2f}s", extra={"analysis": result})
            return result
        except json.JSONDecodeError:
            logger.error("Failed to parse LLM response as JSON", extra={"response": response.text})
            return {
                "error_detected": True,
                "error_type": "unknown",
                "severity": "low",
                "description": "Failed to parse LLM response",
                "recommended_action": "no_action",
                "service_name": None,
                "code_fix": None
            }
    except Exception as e:
        logger.error(f"Error calling LLM API: {str(e)}")
        return {
            "error_detected": False,
            "error_type": "unknown",
            "severity": "low",
            "description": f"Error calling LLM API: {str(e)}",
            "recommended_action": "no_action",
            "service_name": None,
            "code_fix": None
        }

def take_action(analysis):
    """
    Take action based on LLM analysis
    """
    if not analysis.get("error_detected", False):
        logger.info("No error detected, no action needed")
        return {"status": "success", "message": "No action needed"}
    
    service_name = analysis.get("service_name")
    action = analysis.get("recommended_action")
    
    if not service_name or not action:
        logger.warning("Missing service_name or recommended_action in analysis")
        return {"status": "error", "message": "Missing service_name or recommended_action"}
    
    ACTION_COUNTER.labels(action_type=action).inc()
    
    if action == "restart_service":
        return restart_service(service_name)
    elif action == "update_code":
        return update_code(service_name, analysis.get("code_fix"))
    elif action == "increase_resources":
        return increase_resources(service_name)
    else:
        logger.info(f"No action taken for {service_name}")
        return {"status": "success", "message": "No action taken"}

def restart_service(service_name):
    """
    Restart a Kubernetes deployment
    """
    if not k8s_apps_api:
        return {"status": "error", "message": "Kubernetes client not initialized"}
    
    try:
        # Scale down to 0
        logger.info(f"Scaling down {service_name} to 0 replicas")
        k8s_apps_api.patch_namespaced_deployment_scale(
            name=service_name,
            namespace=NAMESPACE,
            body={"spec": {"replicas": 0}}
        )
        
        # Wait for scale down
        time.sleep(5)
        
        # Scale back up to 1
        logger.info(f"Scaling up {service_name} to 1 replica")
        k8s_apps_api.patch_namespaced_deployment_scale(
            name=service_name,
            namespace=NAMESPACE,
            body={"spec": {"replicas": 1}}
        )
        
        return {"status": "success", "message": f"Restarted {service_name}"}
    except Exception as e:
        logger.error(f"Error restarting {service_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

def update_code(service_name, code_fix):
    """
    Update code in a service
    This is a simplified implementation - in a real system, you would:
    1. Create a PR with the fix
    2. Run tests
    3. Merge the PR
    4. Trigger a new deployment
    """
    if not code_fix:
        return {"status": "error", "message": "No code fix provided"}
    
    logger.info(f"Code fix for {service_name}: {code_fix}")
    
    # In a real implementation, you would apply the code fix here
    # For this POC, we'll just log it and simulate success
    
    return {"status": "success", "message": f"Code update for {service_name} initiated"}

def increase_resources(service_name):
    """
    Increase resources for a deployment
    """
    if not k8s_apps_api:
        return {"status": "error", "message": "Kubernetes client not initialized"}
    
    try:
        # Get current deployment
        deployment = k8s_apps_api.read_namespaced_deployment(
            name=service_name,
            namespace=NAMESPACE
        )
        
        # Increase CPU and memory limits by 50%
        containers = deployment.spec.template.spec.containers
        for container in containers:
            if container.resources and container.resources.limits:
                cpu = container.resources.limits.get('cpu')
                memory = container.resources.limits.get('memory')
                
                if cpu and cpu.endswith('m'):
                    cpu_value = int(cpu[:-1])
                    new_cpu = f"{int(cpu_value * 1.5)}m"
                    container.resources.limits['cpu'] = new_cpu
                
                if memory and memory.endswith('Mi'):
                    memory_value = int(memory[:-2])
                    new_memory = f"{int(memory_value * 1.5)}Mi"
                    container.resources.limits['memory'] = new_memory
        
        # Update deployment
        k8s_apps_api.patch_namespaced_deployment(
            name=service_name,
            namespace=NAMESPACE,
            body=deployment
        )
        
        return {"status": "success", "message": f"Increased resources for {service_name}"}
    except Exception as e:
        logger.error(f"Error increasing resources for {service_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    """
    return jsonify({"status": "ok"})

@app.route('/analyze', methods=['POST'])
def analyze_logs():
    """
    Analyze logs and take action
    """
    data = request.json
    
    if not data or 'logs' not in data:
        return jsonify({"status": "error", "message": "Missing logs in request"}), 400
    
    logs = data['logs']
    service_name = data.get('service_name', 'unknown')
    
    # Log to Fluentd
    fluent_sender.emit('logs', {
        'service': service_name,
        'logs': logs,
        'timestamp': time.time()
    })
    
    # Analyze logs with LLM
    analysis = analyze_logs_with_llm(logs)
    
    if analysis.get("error_detected", False):
        ERROR_COUNTER.inc()
    
    # Take action based on analysis
    action_result = take_action(analysis)
    
    return jsonify({
        "status": "success",
        "analysis": analysis,
        "action": action_result
    })

if __name__ == '__main__':
    # Start Prometheus metrics server
    start_http_server(8000)
    
    # Start Flask app
    app.run(host='0.0.0.0', port=5000)
