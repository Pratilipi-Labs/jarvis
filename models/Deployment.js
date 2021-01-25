"use strict";

module.exports = function (sequelize, DataTypes) {
  return sequelize.define("deployment", {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    pipeline: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    pipe: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    trigger: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    owner: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    commit_id: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    reviewer: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    ecr_image: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    task_def: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    added_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    started_at: {
      type: DataTypes.DATE
    },
    finished_at: {
      type: DataTypes.DATE
    },
    completed_at: {
      type: DataTypes.DATE
    }
  }, {
    timestamps: false,
    underscored: true,
    tableName: 'deployment'
  });
};
