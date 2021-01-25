FROM node:14

RUN echo > /etc/apt/sources.list
RUN echo "deb http://deb.debian.org/debian jessie main" >> /etc/apt/sources.list
RUN echo "deb http://security.debian.org/debian-security jessie/updates main" >> /etc/apt/sources.list


RUN apt-get update -y


# Install git
RUN apt-get install -y git

# Install jq
RUN apt-get install -y jq
# Install docker
RUN apt-get install -y \
   apt-transport-https \
   ca-certificates \
   curl \
   gnupg2 \
   software-properties-common
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add -
RUN add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/debian \
   $(lsb_release -cs) \
   stable"
RUN apt-get update -y
RUN apt-get install -y docker-ce

# Install aws cli
RUN apt-get install -y python2.7 python2.7-dev
RUN apt-get install -y python-pip
RUN pip install --user awscli==1.11.92
ENV PATH=$PATH:/root/.local/bin/

EXPOSE 80

# Install app dependencies
COPY package.json .
RUN npm install

# Bundle app source
COPY . .
