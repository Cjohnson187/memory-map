#Stage 1: Build Image for React Development
FROM node:20-alpine AS development

#Set the working directory inside the container
WORKDIR /usr/src/app

#Copy the package.json and package-lock.json (if present)

#Install project dependencies
COPY frontend/package*.json ./
RUN npm install

#Copy all other source code
COPY frontend/ .

#Expose the application port
EXPOSE 3000

#Command to start the React development server (uses Vite or CRA depending on the setup)

#This Dockerfile assumes a simple 'npm start' or 'npm run dev'

#We use the default create-react-app or Vite port 3000
CMD ["npm", "start"]