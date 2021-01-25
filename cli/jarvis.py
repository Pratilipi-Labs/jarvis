import click
import pymysql
import pdb
import sys
import requests
import pprint
import json
import os

from datetime import datetime
from operator import itemgetter
from itertools import groupby
from tabulate import tabulate
from collections import OrderedDict

pp = pprint.PrettyPrinter(indent=4)

conn = pymysql.connect(host='', port=, user='', passwd='', db='')

@click.group()
def jarvis():
	pass

@click.command()
@click.option('--verbose', is_flag=True, help="Will print verbose messages.")
@click.argument('pipeline', required=0)
def show_list(verbose, pipeline=None):
	"""List all pipeline builds with their deployments"""
	limit = 50
	pipeline = " 1 = 1 " if pipeline is None else " pipeline = '{}'".format(pipeline)
	#pipe = " 1 = 1 " if pipe is None else " pipe LIKE '%Prod%'"
	SQL_COMMAND = """SELECT owner, pipeline, pipe, action, state,
				cast(date_format(convert_tz(added_at, @@session.time_zone,'+05:30'), '%Y-%m-%d %T') as char) as process_dt
				FROM jarvis.deployment
				WHERE {}
				ORDER BY added_at desc LIMIT {}""".format(pipeline, limit)

	if verbose:
		print(SQL_COMMAND)

	cur = conn.cursor()#pymysql.cursors.DictCursor)
	cur.execute(SQL_COMMAND)
	table = []
	for row in cur.fetchall():
		table.append(list(row))
	print(tabulate(table, headers=['Owner', 'Pipeline', "Pipe", "Action", "State", "Added at"]))
	cur.close()



@click.command()
@click.option('--verbose', is_flag=True, help="Will print verbose messages.")
@click.argument('pipeline', required=1)
def jlist(verbose, pipeline):
	"""List all pipeline builds with their deployments"""
	SQL_COMMAND = """SELECT A.id, A.pipeline, A.ecr_image, A.commit_id, A.action, A.trigger, A.owner, A.state, B.id, B.pipe, B.action, B.trigger, B.task_def, B.state, B.completed_at
	FROM deployment A, deployment B
	WHERE
	  A.pipeline = '{}'
	  AND A.ecr_image = B.ecr_image
	  AND A.action = 'build'
	  AND B.action = 'deploy'
	ORDER BY
	  A.added_at DESC, A.ecr_image, A.action
	 LIMIT 50""".format(pipeline)

	if verbose:
		print(SQL_COMMAND)

	cur = conn.cursor(pymysql.cursors.DictCursor)
	cur.execute(SQL_COMMAND)
	rows = reversed(cur.fetchall())

	for build, deployments in groupby(rows, key=itemgetter('id', 'pipeline', 'ecr_image', 'commit_id', 'trigger', 'owner', 'state')):
		print('BUILD', build)
		for i in deployments:
			print('          id: {}, pipe: {}, action: deploy, trigger: {}, task_def: {}, state: {}, completed_at: {}'.format(i["B.id"], i["pipe"], i["B.trigger"], i["task_def"], i["B.state"], i["completed_at"]))

		print()
	cur.close()


@click.command()
@click.option('--verbose', is_flag=True, help="Will print verbose messages.")
@click.argument('pipeline', required=1, metavar='<pipeline>')
@click.argument('pipe', required=1, metavar='<pipe>')
def promote(verbose, pipeline, pipe):
	"""Manually promote deployment to next pipe"""
	url = ""
	param_dict = {'pipeline': pipeline, 'fromPipe': pipe}
	r = requests.patch(url, data=param_dict)
	if r.status_code != 200:
		print('Request Failed', r.content)
	else:
		print('Successfully promoted')
		if r.json()['warning']:
			print('Warning:', r.json()['warning'])
		if verbose:
			pp.pprint(r.json()['successObjects'])

@click.command()
@click.option('--verbose', is_flag=True, help="Will print verbose messages.")
@click.argument('pipeline', required=1)
def rebuild(verbose, pipeline):
	"""Rebuild the latest build of the pipeline"""
	click.echo('Rebuild')
	SELECT_SQL_COMMAND = """SELECT * FROM deployment
		WHERE
		  action = 'build'
		  AND pipeline = '{}'
		ORDER BY
		  completed_at desc
		LIMIT 1;""".format(pipeline)

	if verbose:
		print(SELECT_SQL_COMMAND)

	cur = conn.cursor(pymysql.cursors.DictCursor)
	cur.execute(SELECT_SQL_COMMAND)

	DEPLOYMENT_OBJECT = cur.fetchall()[0]

	if DEPLOYMENT_OBJECT["reviewer"] is None:
		INSERT_SQL_COMMAND = """INSERT INTO deployment (`id`, `pipeline`, `action`, `trigger`, `owner`, `commit_id`, `reviewer`, `state`, `added_at`)
			VALUES (NULL, '{}', 'build', '{}', '{}', '{}', NULL, 'WAITING', '{}');""".format(pipeline, DEPLOYMENT_OBJECT["trigger"].split(',')[0] + ',CLI', DEPLOYMENT_OBJECT["owner"], DEPLOYMENT_OBJECT["commit_id"], datetime.utcnow())
	else:
		INSERT_SQL_COMMAND = """INSERT INTO deployment (`id`, `pipeline`, `action`, `trigger`, `owner`, `commit_id`, `reviewer`, `state`, `added_at`)
			VALUES (NULL, '{}', 'build', '{}', '{}', '{}', '{}', 'WAITING', '{}');""".format(pipeline, DEPLOYMENT_OBJECT["trigger"].split(',')[0] + ',CLI', DEPLOYMENT_OBJECT["owner"], DEPLOYMENT_OBJECT["commit_id"], DEPLOYMENT_OBJECT["reviewer"], datetime.utcnow())

	if verbose:
		print(INSERT_SQL_COMMAND)

	cur.execute(INSERT_SQL_COMMAND)
	conn.commit()
	print('Successfully added')

	cur.close()


@click.command()
@click.option('--verbose', is_flag=True, help="Will print verbose messages.")
@click.argument('pipeline', required=1)
@click.argument('pipe', required=1)
def redeploy(verbose, pipeline, pipe):
	"""Redeploy latest deployment of given pipeline and pipe"""
	click.echo('Redeploy')
	SELECT_SQL_COMMAND = """SELECT * FROM deployment
		WHERE
		  action = 'deploy'
		  AND pipeline = '{}'
		  AND pipe = '{}'
		ORDER BY
		  completed_at desc
		LIMIT 1;""".format(pipeline, pipe)

	if verbose:
		print(SELECT_SQL_COMMAND)

	cur = conn.cursor(pymysql.cursors.DictCursor)
	cur.execute(SELECT_SQL_COMMAND)

	DEPLOYMENT_OBJECT = cur.fetchall()[0]

	if DEPLOYMENT_OBJECT["reviewer"] is None:
		INSERT_SQL_COMMAND = """INSERT INTO deployment (`id`, `pipeline`, `pipe`, `action`, `trigger`, `owner`, `commit_id`, `reviewer`, `ecr_image`, `state`, `added_at`)
			VALUES (NULL, '{}', '{}', 'deploy', 'CLI', '{}', '{}', NULL, '{}', 'WAITING', '{}');""".format(pipeline, pipe, DEPLOYMENT_OBJECT["owner"], DEPLOYMENT_OBJECT["commit_id"], DEPLOYMENT_OBJECT["ecr_image"], datetime.utcnow())
	else:
		INSERT_SQL_COMMAND = """INSERT INTO deployment (`id`, `pipeline`, `pipe`, `action`, `trigger`, `owner`, `commit_id`, `reviewer`, `ecr_image`, `state`, `added_at`)
			VALUES (NULL, '{}', '{}', 'deploy', 'CLI', '{}', '{}', '{}', '{}', 'WAITING', '{}');""".format(pipeline, pipe, DEPLOYMENT_OBJECT["owner"], DEPLOYMENT_OBJECT["commit_id"], DEPLOYMENT_OBJECT["reviewer"], DEPLOYMENT_OBJECT["ecr_image"], datetime.utcnow())

	if verbose:
		print(INSERT_SQL_COMMAND)

	cur.execute(INSERT_SQL_COMMAND)
	conn.commit()
	print('Successfully added')

	cur.close()

@click.command()
@click.option('--verbose', is_flag=True, help="Will print verbose messages.")
@click.argument('pipeline', required=1)
@click.argument('pipe', required=1)
def create(verbose, pipeline, pipe):
	"""Setup pipe for given pipeline and pipe"""

	cur = conn.cursor(pymysql.cursors.DictCursor)
	INSERT_SQL_COMMAND = """INSERT INTO deployment (`id`, `pipeline`, `pipe`, `action`, `trigger`, `owner`, `commit_id`, `reviewer`, `ecr_image`, `state`, `added_at`) VALUES (NULL, '{}', '{}', 'create', 'Manual', 'CLI', '', NULL, 'dummy:1', 'WAITING', '{}');""".format(pipeline, pipe, datetime.utcnow())
	if verbose:
		print(INSERT_SQL_COMMAND)

	cur.execute(INSERT_SQL_COMMAND)
	conn.commit()
	print('Successfully added')

	cur.close()

@click.command()
@click.option('--verbose', is_flag=True, help="Will print verbose messages.")
@click.argument('realm', required=1)
@click.argument('filename', required=1)
def create_all(verbose, realm, filename):
	"""Setup all pipes of a pipeline for given realm and filename"""
	absolute_path = input("Enter absolute path to jarvis [eg: /home/root/repo/jarvis]: ")
	file = open("{}/configs/pipelines/{}/{}.js".format(absolute_path,realm,filename),"r")
	body = file.read()
	body = json.loads(body[body.find("{"):body.find(";")])
	pipeline = body["name"];
	cur = conn.cursor(pymysql.cursors.DictCursor)

	for i in body["pipes"]:
		pipe = i["name"]
		INSERT_SQL_COMMAND = """INSERT INTO deployment (`id`, `pipeline`, `pipe`, `action`, `trigger`, `owner`, `commit_id`, `reviewer`, `ecr_image`, `state`, `added_at`) VALUES (NULL, '{}', '{}', 'create', 'Manual', 'CLI', '', NULL, 'dummy:1', 'WAITING', '{}');""".format(pipeline, pipe, datetime.utcnow())
		if verbose:
			print(INSERT_SQL_COMMAND)

		cur.execute(INSERT_SQL_COMMAND)
		conn.commit()
		print('Successfully added')

	cur.close()

@click.command()
def add():
	"""Create file for a service"""
	config = OrderedDict()
	config["name"] = input("Enter Pipeline Name: ")
	config["family"] = input("NOTE: Needs to be same as family.\nEnter File Name : ")
	config["realm"] = input("Enter Realm: ")
	config["source"] = input("Enter Source: ")
	config["owners"] = input("Enter Owners: ").replace(" ","").split(",")
	config["pipes"] = []
	no_of_pipes = int(input("Enter Number of Pipes: "))
	for i in range(1,(no_of_pipes+1)):
		pipe = OrderedDict()
		print("********************************************Pipe #{}********************************************".format(i))
		pipe["name"] = input("NOTE: Needs to be unique across the pipes of a pipeline.\nEnter Pipe Name: ")
		pipe["appName"] = input("NOTE: Needs to be unique across the cluster.\nEnter App Name: ")
		apiEndpoint = input("API Endpoint[Y/N]: ").lower()
		if apiEndpoint == 'y' or apiEndpoint == 'yes':
			pipe["apiEndpoint"] = input("Enter API Endpoint: ")
		pipe["stage"] = input("Enter Stage[devo/gamma/prod]: ")
		pipe["command"] = input("Enter Command to start the Service: ").split(" ")
		pipe["cluster"] = input("Enter Cluster to put this Service in: ")
		pipe["resource"] = OrderedDict()
		pipe["resource"]["cpu"] = int(input("NOTE: Needs to be multiple of 32.\nEnter CPU: "))
		pipe["resource"]["memoryReservation"] = int(input("NOTE: Needs to be multiple of 32.\nEnter Memory Reservation i.e Soft Memory, allocated to service permanently: "))
		pipe["resource"]["memory"] = int(input("NOTE: Needs to be multiple of 32.\nEnter Memory i.e Hard Memory, may be allocated to service if required: "))
		pipe["autoscale"] = OrderedDict()
		pipe["autoscale"]["min"] = int(input("Enter Min Tasks: "))
		pipe["autoscale"]["max"] = int(input("Enter Max Tasks: "))
		pipe["autoscale"]["peak"] = int(input("Enter Peak Tasks: "))
		pipe["approval"] = input("Enter Approval State[manual/automatic]: ")

		config["pipes"].append(pipe)
	absolute_path = input("Enter absolute path to jarvis [eg: /home/root/repo/jarvis]: ")
	file = open("{}/configs/pipelines/{}/{}.js".format(absolute_path,config["realm"],config["family"]),"w")
	file.write("module.exports = {};".format(json.dumps(config, indent=4)))
	file.close()

	print("File created and updated, commit it to codecommit and promote jarvis to reflect changes.")



jarvis.add_command(jlist)
jarvis.add_command(promote)
jarvis.add_command(rebuild)
jarvis.add_command(redeploy)
jarvis.add_command(create)
jarvis.add_command(create_all)
jarvis.add_command(add)
jarvis.add_command(show_list)
