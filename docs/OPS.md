2) Runbook (golden paths)

Local/Server health

# tech-gateway
curl -sS http://localhost:8092/healthz
curl -sS http://localhost:8092/api/tech/health

# brain-api
curl -sS http://localhost:8081/healthz

Logs (CloudWatch)

REGION=us-east-2 IID=<ec2-instance-id>
aws logs describe-log-streams --region "$REGION" --log-group-name "/omneuro/tech-gateway"
aws logs get-log-events --region "$REGION" --log-group-name "/omneuro/tech-gateway" --log-stream-name "$IID/out" --limit 50
aws logs get-log-events --region "$REGION" --log-group-name "/omneuro/tech-gateway" --log-stream-name "$IID/err" --limit 50

PM2

pm2 status
pm2 logs tech-gateway --lines 80
PORT=8092 BRAIN_API_URL=http://localhost:8081 pm2 restart tech-gateway --update-env
pm2 save


⸻