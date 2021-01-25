 PIPELINE=$1
 GIT_REPO=$2
 GIT_BRANCH=$3
 GIT_COMMIT=$4

 if [ "$PIPELINE" == "" ] || [ "$GIT_REPO" == "" ] || [ "$GIT_BRANCH" == "" ] || [ "$GIT_COMMIT" == "" ]
 then
   echo "syntax: bash gitPull.sh <pipeline> <git-repository> <branch> <commit-id>"
   exit 1
 fi

 if [ ! -d "pipeline-$PIPELINE" ]
 then
   git clone -b "$GIT_BRANCH" "$GIT_REPO" pipeline-"$PIPELINE"
 fi

 cd pipeline-"$PIPELINE" || exit
 git fetch
 git reset --hard "$GIT_COMMIT"
 git gc
