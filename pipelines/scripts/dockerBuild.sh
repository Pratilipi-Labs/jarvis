 PIPELINE=$1
 ECR_IMAGE=$2

 if [ "$PIPELINE" == "" ] || [ "$ECR_IMAGE" == "" ]
 then
   echo "syntax: bash build.sh <pipeline> <ecr-image>"
   exit 1
 fi

 cd pipeline-"$PIPELINE" || exit

 ECR_IMAGE=370531249777.dkr.ecr.ap-south-1.amazonaws.com/$ECR_IMAGE

 $(aws ecr get-login --no-include-email --region ap-south-1)
 docker build --tag "$ECR_IMAGE" .

 STATUS=$?
 if [ $STATUS == 0 ]
 then
   echo "build.sh: Successfully built $ECR_IMAGE"
 else
   echo "build.sh: Failed to build $ECR_IMAGE"
   exit $STATUS
 fi
