from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from io import StringIO
from django.core.management import call_command
from django.core.management.base import CommandError

@csrf_exempt
def process_scan(request):
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            token = body.get("token")
            mode = body.get("mode", "entry")
            if not token:
                return JsonResponse({"error": "No token provided"}, status=400)
            
            out = StringIO()
            err = StringIO()
            try:
                call_command("process_token", token=token, mode=mode, json=True, stdout=out, stderr=err)
                output = out.getvalue()
                
                # Extract JSON from output
                json_str = None
                lines = output.splitlines()
                for i, line in enumerate(lines):
                    if line.strip() == "{":
                        json_str = "\n".join(lines[i:])
                        break
                        
                if json_str:
                    try:
                        parsed = json.loads(json_str)
                        flag = parsed.get("exitFlag") or parsed.get("entryFlag") or parsed.get("entry_flag") or ("NORMAL_ENTRY" if mode == "entry" else "NORMAL_EXIT")
                        return JsonResponse({
                            "success": True,
                            "status": "ALLOWED",
                            "flag": flag,
                            "mode": mode,
                            "roll": parsed.get("roll"),
                            "name": parsed.get("name"),
                            "laptop": parsed.get("laptop"),
                            "extra": parsed.get("extra") or [],
                            "message": "Verified successfully",
                            "isVerified": True
                        })
                    except json.JSONDecodeError:
                        return JsonResponse({"error": "Failed to parse command output"}, status=500)
                else:
                    return JsonResponse({"error": "No JSON found in command output", "output": output}, status=500)
                    
            except CommandError as e:
                return JsonResponse({
                    "success": False,
                    "status": "DENIED",
                    "flag": "DENIED",
                    "mode": mode,
                    "message": str(e)
                })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)
