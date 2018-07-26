#!/bin/bash -x

if [[ -z "$SRV_IP" ]]
then
  echo "SRV_IP is not set"
  exit 1
fi
if [[ -z "$SRV_PORT" ]]
then
  echo "SRV_PORT is not set"
  exit 1
fi

#Set up users
copyrootkeys
ssh -p ${SRV_PORT} root@${SRV_IP} <<EOF
set -x
useradd vuiisdev -d /home/vuiisdev
chsh vuiisdev -s /bin/bash
groupadd smda
usermod -aG smda vuiisdev
usermod -aG vboxsf vuiisdev
EOF
copydevkeys

#Install basic yum packages
ssh -p ${SRV_PORT} root@${SRV_IP} <<EOF
set -x
yum -y update
yum -y groupinstall 'Development tools'
yum -y install epel-release
yum -y install python-devel policycoreutils-python kernel-devel
yum -y install java-1.7.0-openjdk python-pip uwsgi
yum -y install postgresql-devel sshfs nmap-ncat
yum -y install nginx memcached postgresql-server samba-client cifs-utils
yum -y install supervisor
yum -y install vim git pip
EOF

#Setup virtualenv and folders
ssh -p ${SRV_PORT} root@${SRV_IP} <<EOF
set -x
pip install virtualenv
mkdir -p /home/smda/cache
chown -R vuiisdev:smda /home/smda
chmod -R 775 /home/smda
mkdir -p /srv/smda/{css,img,js,html,fonts} /opt/smda/web_server
chown -R vuiisdev:smda /opt/smda
chmod -R 770 /opt/smda
chown -R vuiisdev:smda /srv/smda
chmod -R 775 /srv/smda
usermod -aG smda nginx
chown -R vuiisdev:smda /home/smda
mkdir -p /etc/pki/wcssl/ /etc/keys
EOF

copyconfig
copysslkeys

#Set up services
ssh -p ${SRV_PORT} root@${SRV_IP} <<EOF
set -x
chkconfig supervisord on
chkconfig nginx on
chkconfig memcached on
chkconfig postgresql on
EOF

copystatic
copyapp

#Upgrade pip
ssh -p ${SRV_PORT} vuiisdev@${SRV_IP} <<EOF
set -x
chmod 600 /opt/smda/smda-app.cfg
virtualenv /opt/smda/python-venv --distribute
source /opt/smda/python-venv/bin/activate
pip install --upgrade setuptools
pip install --upgrade distribute
pip install --upgrade pip
pip install argparse Flask Flask-wtf Flask-JWT kombu python-dateutil python-memcached requests pytz
pip install psycopg2 Pillow numpy scikit-image PyYAML
EOF

#SELinux changes
ssh -p ${SRV_PORT} root@${SRV_IP} <<EOF
set -x
semanage fcontext -a -t httpd_sys_content_t "/home/smda(/.*)?"
restorecon -Rv /home/smda/
/opt/smda/init-db.sh
/opt/smda/python-venv/bin/python /opt/smda/web_server/meta_updater --no-ask-pass
semanage fcontext -a -t httpd_sys_content_t "/srv/smda/css(/.*)?"
semanage fcontext -a -t httpd_sys_content_t "/srv/smda/img(/.*)?"
semanage fcontext -a -t httpd_sys_content_t "/srv/smda/js(/.*)?"
semanage fcontext -a -t httpd_sys_content_t "/srv/smda/html(/.*)?"
semanage fcontext -a -t httpd_sys_content_t "/srv/smda/fonts(/.*)?"
restorecon -Rv /srv/smda/
/root/install-nginx-module.sh
/opt/smda/python-venv/bin/python /opt/smda/web_server/update_hashes
EOF

#Set up firewall
ssh -p ${SRV_PORT} root@${SRV_IP} <<EOF
set -x
firewall-cmd --permanent --zone=public --add-service=http
firewall-cmd --permanent --zone=public --add-service=https
firewall-cmd --reload
EOF

copycerts

#Reboot
ssh -p ${SRV_PORT} root@${SRV_IP} <<EOF
set -x
reboot
EOF

