#!/bin/bash -x
mkdir -p /var/lib/pgsql/data/
chown -R postgres:postgres /var/lib/pgsql/data/
cd /var/lib/pgsql

service postgresql stop
service postgresql initdb
service postgresql start

su postgres <<EOF
createuser -sr postgres
createuser -SDR smda
createdb smda -O smda
EOF

SMDA_PASS=$(date +%s | sha256sum | base64 | head -c 16; echo)
env SMDA_PASS=$SMDA_PASS su vuiisdev <<EOF
cd /opt/smda/
sed '/connect_str:.*/d' smda-db.cfg.template > smda-db.cfg
chmod 600 smda-db.cfg
echo -e "connect_str: dbname=smda user=smda password=${SMDA_PASS}\n" >> smda-db.cfg
EOF

env SMDA_PASS=$SMDA_PASS su postgres <<EOF
echo "ALTER ROLE smda WITH UNENCRYPTED PASSWORD '${SMDA_PASS}';" | psql
EOF

#Copy Host-Based Authorization configuration file
cp -f /opt/smda/pg_hba.conf /var/lib/pgsql/data/
service postgresql reload

