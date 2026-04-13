#!/usr/bin/env python3
"""
Deep Agent Backend API Testing
Tests all API endpoints for the Deep Learning training platform
"""

import requests
import json
import sys
import time
import websocket
import threading
from datetime import datetime

class DeepAgentAPITester:
    def __init__(self, base_url="https://neural-agent-studio.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.ws_url = base_url.replace("https://", "wss://")
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None
        self.ws_messages = []
        self.ws_connected = False

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=10):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        self.log("\n=== Testing Basic Endpoints ===")
        
        # Test root endpoint
        success, response = self.run_test(
            "Root API",
            "GET", 
            "",
            200
        )
        if success and response.get("message") == "Deep Agent API v1.0":
            self.log("✅ Root API returns correct message")
        else:
            self.log("❌ Root API message incorrect")

        # Test agent status
        success, response = self.run_test(
            "Agent Status",
            "GET",
            "agent/status", 
            200
        )
        if success and response.get("status") == "online":
            self.log("✅ Agent status is online")
        else:
            self.log("❌ Agent status incorrect")

    def test_code_linting(self):
        """Test code linting functionality"""
        self.log("\n=== Testing Code Linting ===")
        
        # Test valid PyTorch code
        valid_code = """
import torch
import torch.nn as nn

class SimpleNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc = nn.Linear(10, 1)
    
    def forward(self, x):
        return self.fc(x)
"""
        success, response = self.run_test(
            "Lint Valid Code",
            "POST",
            "code/lint",
            200,
            {"code": valid_code}
        )
        if success:
            self.log(f"✅ Lint valid code - Errors: {len(response.get('errors', []))}")

        # Test syntax error code
        syntax_error_code = """
import torch
class BadClass(
    def __init__(self):
        pass
"""
        success, response = self.run_test(
            "Lint Syntax Error",
            "POST", 
            "code/lint",
            200,
            {"code": syntax_error_code}
        )
        if success and len(response.get('errors', [])) > 0:
            self.log("✅ Lint detects syntax errors")
        else:
            self.log("❌ Lint should detect syntax errors")

        # Test PyTorch-specific issues
        pytorch_issue_code = """
# Missing import torch but using torch functions
model = nn.Linear(10, 1)
optimizer = optim.Adam(model.parameters())
"""
        success, response = self.run_test(
            "Lint PyTorch Issues",
            "POST",
            "code/lint", 
            200,
            {"code": pytorch_issue_code}
        )
        if success and len(response.get('errors', [])) > 0:
            self.log("✅ Lint detects PyTorch-specific issues")
        else:
            self.log("❌ Lint should detect missing torch import")

    def test_training_endpoints(self):
        """Test training management endpoints"""
        self.log("\n=== Testing Training Endpoints ===")
        
        # Test start training
        training_config = {
            "code": "import torch\nprint('Hello PyTorch')",
            "epochs": 5,
            "learning_rate": 0.001,
            "batch_size": 32,
            "model_name": "TestModel"
        }
        
        success, response = self.run_test(
            "Start Training",
            "POST",
            "training/start",
            200,
            training_config
        )
        
        if success and "session_id" in response:
            self.session_id = response["session_id"]
            self.log(f"✅ Training started - Session: {self.session_id[:8]}...")
        else:
            self.log("❌ Failed to start training")
            return

        # Test training history
        success, response = self.run_test(
            "Training History",
            "GET",
            "training/history",
            200
        )
        if success and isinstance(response, list):
            self.log(f"✅ Training history - {len(response)} sessions")
        else:
            self.log("❌ Training history failed")

        # Test stop training
        if self.session_id:
            success, response = self.run_test(
                "Stop Training",
                "POST",
                f"training/stop/{self.session_id}",
                200
            )
            if success:
                self.log("✅ Training stopped successfully")

    def test_ai_assistant(self):
        """Test AI assistant endpoint"""
        self.log("\n=== Testing AI Assistant ===")
        
        success, response = self.run_test(
            "AI Assistant",
            "POST",
            "code/assist",
            200,
            {
                "message": "What is PyTorch?",
                "context": "import torch",
                "session_id": "test-session"
            },
            timeout=30  # AI calls can take longer
        )
        
        if success and "response" in response:
            self.log("✅ AI Assistant responded")
            self.log(f"   Response preview: {response['response'][:100]}...")
        else:
            self.log("❌ AI Assistant failed")

    def on_ws_message(self, ws, message):
        """WebSocket message handler"""
        try:
            data = json.loads(message)
            self.ws_messages.append(data)
            self.log(f"📡 WS: {data.get('type', 'unknown')} - {data.get('data', {}).get('message', '')[:50]}")
        except Exception as e:
            self.log(f"❌ WS message parse error: {e}")

    def on_ws_open(self, ws):
        """WebSocket open handler"""
        self.ws_connected = True
        self.log("✅ WebSocket connected")
        
        # Send start training command
        start_command = {
            "action": "start",
            "config": {
                "code": "import torch\nprint('WebSocket test')",
                "epochs": 2,
                "learning_rate": 0.001,
                "batch_size": 32,
                "model_name": "WSTestModel"
            }
        }
        ws.send(json.dumps(start_command))
        self.log("📤 Sent start training command")

    def on_ws_close(self, ws, close_status_code, close_msg):
        """WebSocket close handler"""
        self.log(f"🔌 WebSocket closed: {close_status_code}")

    def on_ws_error(self, ws, error):
        """WebSocket error handler"""
        self.log(f"❌ WebSocket error: {error}")

    def test_websocket(self):
        """Test WebSocket training functionality"""
        self.log("\n=== Testing WebSocket Training ===")
        
        if not self.session_id:
            # Create a new session for WebSocket testing
            training_config = {
                "code": "import torch\nprint('WebSocket test')",
                "epochs": 2,
                "learning_rate": 0.001,
                "batch_size": 32,
                "model_name": "WSTestModel"
            }
            
            success, response = self.run_test(
                "Create WS Session",
                "POST",
                "training/start",
                200,
                training_config
            )
            
            if success and "session_id" in response:
                self.session_id = response["session_id"]
            else:
                self.log("❌ Failed to create session for WebSocket test")
                return

        # Test WebSocket connection
        ws_url = f"{self.ws_url}/api/ws/training/{self.session_id}"
        self.log(f"🔗 Connecting to: {ws_url}")
        
        try:
            ws = websocket.WebSocketApp(
                ws_url,
                on_message=self.on_ws_message,
                on_open=self.on_ws_open,
                on_close=self.on_ws_close,
                on_error=self.on_ws_error
            )
            
            # Run WebSocket in a thread
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection and some messages
            time.sleep(3)
            
            if self.ws_connected:
                self.log("✅ WebSocket connection established")
                self.tests_passed += 1
            else:
                self.log("❌ WebSocket connection failed")
            
            self.tests_run += 1
            
            # Wait for training messages
            time.sleep(5)
            
            # Check if we received training events
            event_types = [msg.get('type') for msg in self.ws_messages]
            if 'epoch' in event_types or 'batch' in event_types:
                self.log("✅ Received training events via WebSocket")
                self.tests_passed += 1
            else:
                self.log("❌ No training events received")
            
            self.tests_run += 1
            
            # Close WebSocket
            ws.close()
            
        except Exception as e:
            self.log(f"❌ WebSocket test failed: {e}")
            self.tests_run += 1

    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting Deep Agent Backend Tests")
        self.log(f"🎯 Target: {self.base_url}")
        
        start_time = time.time()
        
        try:
            self.test_basic_endpoints()
            self.test_code_linting()
            self.test_training_endpoints()
            self.test_ai_assistant()
            self.test_websocket()
            
        except KeyboardInterrupt:
            self.log("\n⚠️ Tests interrupted by user")
        except Exception as e:
            self.log(f"\n❌ Unexpected error: {e}")
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Print results
        self.log(f"\n📊 Test Results:")
        self.log(f"   Tests run: {self.tests_run}")
        self.log(f"   Tests passed: {self.tests_passed}")
        self.log(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "   Success rate: 0%")
        self.log(f"   Duration: {duration:.2f}s")
        
        return self.tests_passed == self.tests_run

def main():
    tester = DeepAgentAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())