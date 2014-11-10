#!/bin/sh
set -e
killall nodejs || true
nohup nodejs retail-demo-mysql.js 3000 &
nohup nodejs retail-demo-mysql.js 3001 &
nohup nodejs retail-demo-mysql.js 3002 &
nohup nodejs retail-demo-mysql.js 3003 &
nohup nodejs retail-demo-mysql.js 3004 &
nohup nodejs retail-demo-mysql.js 3005 &
nohup nodejs retail-demo-mysql.js 3006 &
nohup nodejs retail-demo-mysql.js 3007 &
top
