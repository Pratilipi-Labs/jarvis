"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const config = require('./../configs/sql');

const sequelize = new Sequelize(config.DB_MYSQL_DATABASE, process.env.MYSQL_DB_USERNAME, process.env.MYSQL_DB_PASSWORD, {
    logging: false,
    host: config.DB_MYSQL_HOST,
    port: config.DB_MYSQL_PORT,
    dialect: 'mysql',
    define: {underscored: true},
    pool: {
        idle: 20000,
        acquire: 20000
    }
});

const db = {};

const tableModelMap = {
    'deployment': 'Deployment'
};

fs
    .readdirSync(__dirname)
    .filter(function (file) {
        return (file.indexOf(".") !== 0) && (file !== "index.js");
    })
    .forEach(function (file) {
        const model = sequelize.import(path.join(__dirname, file));
        db[tableModelMap[model.name]] = model;
    });

Object.keys(db).forEach(function (modelName) {
    if ("associate" in db[modelName]) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
module.exports = db;
