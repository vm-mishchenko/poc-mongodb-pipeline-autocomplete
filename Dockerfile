FROM node:14-alpine As development

WORKDIR /usr/src/app

# <src-path> <destination-path>
COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:14-alpine as production

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./

# If you are building your code for production
# This command is similar to npm install, except it’s meant to be used in automated environments
# such as test platforms, continuous integration, and deployment – or any situation where you want
# to make sure you’re doing a clean install of your dependencies. It can be significantly faster
# than a regular npm install by skipping certain user-oriented features.
# It is also more strict than a regular install, which can help catch errors or inconsistencies caused by the incrementally-installed local environments of most npm users.
RUN npm ci --only=production

# copy public files
COPY --from=development /usr/src/app/public /usr/src/app/public

# copy builded next app from the previous `development` step
COPY --from=development /usr/src/app/.next /usr/src/app/.next

# default port that Next.js web server listens to
EXPOSE 3000

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry.
ENV NEXT_TELEMETRY_DISABLED 1

# starts Next.js server
CMD ["npm", "start"]
