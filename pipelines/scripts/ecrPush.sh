 PIPELINE=$1
 ECR_IMAGE=$2

 if [ "$PIPELINE" == "" ] || [ "$ECR_IMAGE" == "" ]
 then
   echo "syntax: bash push.sh <pipeline> <ecr-image>"
   exit 1
 fi

 ECR_IMAGE=370531249777.dkr.ecr.ap-south-1.amazonaws.com/$ECR_IMAGE

 $(aws ecr get-login --no-include-email --region ap-south-1)
 docker push "$ECR_IMAGE"

 STATUS=$?
 if [ $STATUS == 0 ]
 then
   echo "push.sh: Successfully pushed $ECR_IMAGE"
 else
   echo "push.sh: Failed to push $ECR_IMAGE"
   exit $STATUS
 fi
