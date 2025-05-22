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
    
    Provide your analysis in the following JSON format. 
    If "recommended_action" is "increase_resources", you MUST provide "target_cpu" AND "target_memory" with appropriate Kubernetes resource values (e.g., "1500m" for CPU, "1Gi" for memory). 
    Otherwise, "target_cpu" and "target_memory" can be null or omitted.

    Example 1: Increase resources
    {{
        "error_detected": true,
        "error_type": "resource_error",
        "severity": "high",
        "description": "Service 'orders-service' is experiencing high CPU usage and OOMKilled errors.",
        "recommended_action": "increase_resources",
        "service_name": "orders-service",
        "target_cpu": "1500m",
        "target_memory": "1Gi",
        "code_fix": null
    }}

    Example 2: Other action
    {{
        "error_detected": true,
        "error_type": "code_error",
        "severity": "critical",
        "description": "Null pointer exception in payment processing at checkout.",
        "recommended_action": "restart_service",
        "service_name": "payment-service",
        "target_cpu": null,
        "target_memory": null,
        "code_fix": "Possible fix: Check for null on 'user.cart.items' before accessing."
    }}
    
    Only respond with a single, valid JSON object. No other text.
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

    # Validate service_name by checking if the deployment exists
    if k8s_apps_api:
        try:
            logger.info(f"Validating service: {service_name} in namespace: {NAMESPACE}")
            k8s_apps_api.read_namespaced_deployment(name=service_name, namespace=NAMESPACE)
            logger.info(f"Service {service_name} validated successfully.")
        except client.exceptions.ApiException as e:
            if e.status == 404:
                logger.error(f"Deployment '{service_name}' not found in namespace '{NAMESPACE}'. Skipping action.")
                return {"status": "error", "message": f"Deployment '{service_name}' not found."}
            else:
                logger.error(f"Error validating deployment '{service_name}': {str(e)}")
                return {"status": "error", "message": f"Error validating deployment '{service_name}': {str(e)}"}
        except Exception as e:
            logger.error(f"Unexpected error validating deployment '{service_name}': {str(e)}")
            return {"status": "error", "message": f"Unexpected error validating deployment '{service_name}': {str(e)}"}
    else:
        logger.warning("Kubernetes client (k8s_apps_api) not initialized. Skipping service_name validation.")

    action_result = None
    logger.info(f"Invoking action '{action}' for service '{service_name}' in namespace '{NAMESPACE}'.")
    if action == "restart_service":
        action_result = restart_service(service_name)
    elif action == "update_code":
        action_result = update_code(service_name, analysis.get("code_fix"))
    elif action == "increase_resources":
        action_result = increase_resources(service_name, analysis)
    else:
        logger.info(f"No specific action configured for '{action}' on service '{service_name}'. No action taken.")
        action_result = {"status": "success", "message": "No action taken"}
    
    logger.info(f"Action '{action}' for service '{service_name}' in namespace '{NAMESPACE}' completed. Result: {action_result}")
    return action_result

def restart_service(service_name):
    """
    Restart a Kubernetes deployment
    """
    logger.info(f"Attempting to restart service: {service_name} in namespace {NAMESPACE}")
    if not k8s_apps_api:
        logger.error(f"Cannot restart service {service_name} in namespace {NAMESPACE}: Kubernetes client not initialized.")
        return {"status": "error", "message": "Kubernetes client not initialized"}
    
    try:
        # Backup deployment spec before making changes
        logger.info(f"Reading deployment spec for {service_name} in namespace {NAMESPACE} for backup.")
        deployment = k8s_apps_api.read_namespaced_deployment(
            name=service_name,
            namespace=NAMESPACE
        )
        deployment_yaml = yaml.dump(deployment.to_dict(), sort_keys=False)
        logger.info(f"Backing up deployment spec for {service_name} in namespace {NAMESPACE}:\n{deployment_yaml}")

        # Scale down to 0
        logger.info(f"Scaling down {service_name} in namespace {NAMESPACE} to 0 replicas")
        k8s_apps_api.patch_namespaced_deployment_scale(
            name=service_name,
            namespace=NAMESPACE,
            body={"spec": {"replicas": 0}}
        )
        
        # Wait for scale down
        time.sleep(5)
        
        # Scale back up to 1
        logger.info(f"Scaling up {service_name} in namespace {NAMESPACE} to 1 replica")
        k8s_apps_api.patch_namespaced_deployment_scale(
            name=service_name,
            namespace=NAMESPACE,
            body={"spec": {"replicas": 1}}
        )
        
        logger.info(f"Successfully restarted service: {service_name} in namespace {NAMESPACE}")
        return {"status": "success", "message": f"Restarted {service_name}"}
    except Exception as e:
        logger.error(f"Error restarting {service_name} in namespace {NAMESPACE}: {str(e)}")
        return {"status": "error", "message": f"Error restarting {service_name} in namespace {NAMESPACE}: {str(e)}"}

def update_code(service_name, code_fix):
    """
    Update code in a service
    This is a simplified implementation - in a real system, you would:
    1. Create a PR with the fix
    2. Run tests
    3. Merge the PR
    4. Trigger a new deployment
    """
    logger.info(f"Attempting to apply code update for service: {service_name} in namespace {NAMESPACE} (Code fix: {'Provided' if code_fix else 'Not provided'})")
    if not code_fix:
        logger.warning(f"No code fix provided for service: {service_name} in namespace {NAMESPACE}. No action taken.")
        return {"status": "error", "message": "No code fix provided"}
    
    # In a real implementation, you would apply the code fix here
    # For this POC, we'll just log it and simulate success
    logger.info(f"Simulated code update for service: {service_name} in namespace {NAMESPACE}. Code fix details: {code_fix}. In a real system, a CI/CD pipeline would be triggered.")
    return {"status": "success", "message": f"Code update for {service_name} initiated (simulated)"}

def increase_resources(service_name, analysis):
    """
    Increase resources for a deployment based on target values in analysis.
    """
    target_cpu = analysis.get("target_cpu")
    target_memory = analysis.get("target_memory")
    logger.info(f"Attempting to set resources for service: {service_name} in namespace {NAMESPACE} to CPU: {target_cpu}, Memory: {target_memory}")

    if not k8s_apps_api:
        logger.error(f"Cannot set resources for service {service_name} in namespace {NAMESPACE}: Kubernetes client not initialized.")
        return {"status": "error", "message": "Kubernetes client not initialized"}

    if not target_cpu or not target_memory:
        logger.warning(f"Target CPU or Memory not provided for {service_name} in namespace {NAMESPACE}. No action taken.")
        return {"status": "warning", "message": "Missing target_cpu or target_memory. No action taken."}

    try:
        # Get current deployment
        deployment = k8s_apps_api.read_namespaced_deployment(
            name=service_name,
            namespace=NAMESPACE
        )
        
        # Log the current deployment spec as YAML before modification
        deployment_yaml = yaml.dump(deployment.to_dict(), sort_keys=False)
        logger.info(f"Backing up deployment spec for {service_name} in namespace {NAMESPACE} before resource change:\n{deployment_yaml}")

        # Set new CPU and memory limits
        containers = deployment.spec.template.spec.containers
        for container in containers:
            if not container.resources:
                container.resources = client.V1ResourceRequirements()
            if not container.resources.limits:
                container.resources.limits = {}
            
            container.resources.limits['cpu'] = target_cpu
            container.resources.limits['memory'] = target_memory
            logger.info(f"Setting resources for container {container.name} in deployment {service_name} (namespace {NAMESPACE}) to cpu: {target_cpu}, memory: {target_memory}")
        
        # Update deployment
        k8s_apps_api.patch_namespaced_deployment(
            name=service_name,
            namespace=NAMESPACE,
            body=deployment
        )
        
        logger.info(f"Successfully set resources for service: {service_name} in namespace {NAMESPACE} to CPU: {target_cpu}, Memory: {target_memory}")
        return {"status": "success", "message": f"Set resources for {service_name} to cpu: {target_cpu}, memory: {target_memory}"}
    except Exception as e:
        logger.error(f"Error setting resources for {service_name} in namespace {NAMESPACE}: {str(e)}")
        return {"status": "error", "message": f"Error setting resources for {service_name} in namespace {NAMESPACE}: {str(e)}"}

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
