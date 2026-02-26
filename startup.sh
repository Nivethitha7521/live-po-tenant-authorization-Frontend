#!/bin/bash
cd /var/www/vhosts/yenerp.com/purchaseapi/app
nohup uvicorn purchaseapi:app --port 8019 --reload > /dev/null 2>&1 &
#nohup uvicorn main:app --host 127.0.0.1 --port 8080 --reload > /dev/null 2>&1 &


