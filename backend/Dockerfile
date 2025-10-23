#Stage 1: Build Image
FROM node:20-alpine AS development

#Set the working directory inside the container
WORKDIR /usr/src/app

#Copy the package.json and package-lock.json (if present)

#This step is done first to leverage Docker cache if dependencies don't change
COPY backend/package*.json ./

#Install project dependencies
RUN npm install

#Copy all other source code
COPY backend/ .

#Expose the application port
EXPOSE 8080

#The startup command is defined in docker-compose.yml (npm run dev)

#This Dockerfile is optimized for the development build defined in docker-compose.