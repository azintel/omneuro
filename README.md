# omneuro / brain-api

## Overview
**brain-api** is a Node.js + Express backend providing unified Google API integration (Docs, Sheets, Drive) plus admin automation endpoints for remote deployment.

You can:
- Create and edit Google Docs
- Create and append Google Sheets
- List Google Drive files
- Trigger EC2 server pulls + restarts from GitHub Actions or manually

---

## Tech Stack
- **Node.js** (ESM modules)
- **Express.js**
- **Google APIs Node.js Client**
- **PM2** for process management
- **GitHub Actions** for automated deployment to EC2
- **AWS EC2** (Ubuntu) hosting

---

## Local Development

### 1. Clone & install
```bash
git clone git@github.com:azintel/omneuro.git
cd omneuro/apps/brain-api
npm install- deploy test Wed Aug 13 20:54:37 EDT 2025
