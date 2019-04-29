import copy
import hug
from hug.middleware import CORSMiddleware
import json 


api = hug.API(__name__)
api.http.add_middleware(CORSMiddleware(api))

res = []


def fordFulkerson(graph, source, sink, debug=None):
    res.clear()
    flow, path = 0, True
    while path:
        graph1 = copy.deepcopy(graph)
        path, reserve = depthSearch(graph, graph1, source, sink)
        flow += float(reserve)
        for v, u in zip(path, path[1:]):
            if graph[v][u]['direction'] == '+':
                graph[v][u]['flow'] += float(reserve)
            else:
                graph[u][v]['flow'] -= reserve
        if callable(debug):
            debug(graph, path, reserve, flow)

def depthSearch(graph, graph1, source, sink):
    explored = {source}
    stack = [(source, 0, dict(graph1[source]))]
    while stack:
        v, _, neighbours = stack[-1]
        if v == sink:
            break
        while neighbours:
            u, e = neighbours.popitem()
            if u not in explored:
                break
        else:
            stack.pop()
            continue
        if graph[v][u]['direction'] == '+':
            inDirection = True
        else:
            inDirection = False
    
        capacity = float(e['capacity'])
        flow = float(e['flow'])
        neighbours = graph1[u]
        if inDirection and flow < capacity:
            stack.append((u, capacity - flow, neighbours))
            explored.add(u)
        elif not inDirection and flow:
            stack.append((u, flow, neighbours))
            explored.add(u)
    reserve = min((f for _, f, _ in stack[1:]), default=0)
    path = [v for v, _, _ in stack]
    return path, reserve

def flowPrint(graph, path, reserve, flow):

    print('flow increased by', reserve,
          'at path', path,
          '; current flow', flow)
    if not len(path): return
    sol = {"flow": flow, "path": path, "reserve": reserve}
    res.append(sol)

@hug.static('/static')
def static():
    return('static',)

@hug.get('/home', output=hug.output_format.html)
def root():
    html = None
    with open('graph2.html') as myfile:
        html=myfile.read()
    return html


@hug.post()
def sendRes(input, sink, source):
    graph = {}

    source = int(source)
    sink = int(sink)
    for node in input:
        if node["from"] not in graph: graph[node["from"]] = {}
        if node["to"] not in graph: graph[node["to"]] = {}
        graph[node["from"]][node["to"]] = {'direction': '+', 'capacity': float(node["capacity"]), 'flow': 0}
        graph[node["to"]][node["from"]] = {'direction': '-', 'capacity': float(node["capacity"]), 'flow': 0}
    fordFulkerson(graph, source, sink, flowPrint)
    return json.dumps(res)
