module.exports = {
    "name": "",
    "family": "",
    "realm": "",
    "source": `https://<Version-Control-Provider-Link>/<Organisation-Name>/<Repository-Name>:<Branch-Name>`, // HTTPS url of version control with repo path and branch separated by :
    "region": "",
    "credentials": {
        "username": `${process.env.VERSION_CONTROL_USERNAME}`,
        "password": `${process.env.VERSION_CONTROL_PASSWORD}`
    },
    "owners": [
    //    code reviewers who can review this codebase
    ],
    "pipes": [
        {
            "name": "", // unique identifier to distinguish between pipes
            "appName": "", // unique among clusters
            "apiEndpoint": "", //endpoint to add in Application Load Balancers Listener rules
            "stage": "",
            "command": [
            //    command used to run the docker container
            ],
            "cluster": "",
            "accountId": 123456789,
            "region": "",
            "resource": {
                "cpu": 1234,
                "memoryReservation": 1234,
                "memory": 1234
            },
            "approval": "automatic"
        },
        {
            "name": "", // unique identifier to distinguish between pipes
            "appName": "", // unique among clusters
            "apiEndpoint": "", //endpoint to add in Application Load Balancers Listener rules
            "stage": "",
            "command": [
                //    command used to run the docker container
            ],
            "cluster": "",
            "accountId": 123456789,
            "region": "",
            "resource": {
                "cpu": 1234,
                "memoryReservation": 1234,
                "memory": 1234
            },
            "approval": "manual"
        }
    ]
};
