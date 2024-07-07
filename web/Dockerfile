# Base Node image
FROM node:alpine

# Set working directory
WORKDIR /app

# Add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

#RUN npm config set strict-ssl false
RUN npm install -g npm

# install app dependencies
COPY package.json package-lock.json ./

RUN npm install

# add app
COPY . ./

# start app
CMD ["npm", "start"]
