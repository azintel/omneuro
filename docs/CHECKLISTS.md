•	Create src/routes/<name>.ts, export router
	•	Wire into src/server.ts with app.use("/api/<name>", router)
	•	Add /health route
	•	Add src/public/index.html (minimal)
	•	npm run build → ensure dist/routes/<name>.js
	•	PM2 env set + pm2 save
	•	Logs visible in CloudWatch under /omneuro/<name>
	•	Add Makefile targets
    	•	Document route contracts here