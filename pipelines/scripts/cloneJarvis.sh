PIPELINE=$1
GIT_REPO=$2
GIT_BRANCH=$3

if [ "$PIPELINE" == "" ] || [ "$GIT_REPO" == "" ] || [ "$GIT_BRANCH" == "" ]
 then
   echo "syntax: bash cloneJarvis.sh <pipeline> <git-repository> <branch>"
   exit 1
fi


git clone -b "$GIT_BRANCH" "$GIT_REPO" pipeline-"$PIPELINE"
