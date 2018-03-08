#!/bin/bash
cd /root && checkmodule -M -m -o nginx.mod nginx.te && semodule_package -o nginx.pp -m nginx.mod && semodule -i nginx.pp
