#!/bin/sh
set -e
killall nodejs || true
rm -f nohup.out || true
nohup nodejs retail-demo-server.js 3000 &
nohup nodejs retail-demo-server.js 3001 &
nohup nodejs retail-demo-server.js 3002 &
nohup nodejs retail-demo-server.js 3003 &
nohup nodejs retail-demo-server.js 3004 &
nohup nodejs retail-demo-server.js 3005 &
nohup nodejs retail-demo-server.js 3006 &
nohup nodejs retail-demo-server.js 3007 &
top
