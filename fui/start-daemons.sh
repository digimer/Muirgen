#pm2 start backend/index.js --name ui.backend
#pm2 start "npm run dev -- --host" --name "ui.frontend" --cwd /home/admin/fui/frontend
#pm2 start ui.backend
#pm2 start ui.frontend
pm2 start all

