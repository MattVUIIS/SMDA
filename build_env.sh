print_usage() {
  echo "build_env.sh {SRV_IP} {SRV_PORT}"
}

if [[ -z "$1" || -z "$2" ]]
then
  print_usage
fi

OS=$(uname -s)
if [[ "$OS" == "Linux" ]]
then
    export PROJECTHOME=$(dirname $(readlink -m $0))
else # MAC
    export PROJECTHOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

#Remove tools directory from PATH, if present
export PATH=$(echo $PATH | sed -e "s~:${PROJECTHOME}/tools$~~")

#Add tools directory to PATH
export PATH=${PATH}:${PROJECTHOME}/tools
export SRV_IP=$1
export SRV_PORT=$2
