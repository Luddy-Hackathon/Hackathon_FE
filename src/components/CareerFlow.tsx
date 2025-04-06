// components/CareerFlow.tsx
"use client";

import React, { useCallback, useLayoutEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  ConnectionMode,
  useReactFlow,
  Panel,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import * as d3 from 'd3';
import 'reactflow/dist/style.css';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Briefcase, 
  GraduationCap, 
  Target, 
  Play, 
  Book, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Move,
  GitBranch,
  Route,
  Info
} from 'lucide-react';

interface CareerFlowProps {
  initialNodes: Node[];
  initialEdges: Edge[];
}

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  position: { x: number; y: number };
  data: any;
  type?: string;
}

const CustomNode = ({ data }: any) => {
  const getIcon = () => {
    switch (data.type) {
      case 'start':
        return <Play className="w-5 h-5 text-green-600" />;
      case 'course':
        return <Book className="w-5 h-5 text-blue-600" />;
      case 'internship':
        return <Briefcase className="w-5 h-5 text-purple-600" />;
      case 'project':
        return <GraduationCap className="w-5 h-5 text-orange-600" />;
      case 'goal':
        return <Target className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'current':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'upcoming':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="min-w-[250px] max-w-[350px] p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer bg-white/90 backdrop-blur-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-gray-50">
              {getIcon()}
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase">
              {data.type}
            </span>
          </div>
          {data.status && (
            <Badge variant="outline" className={`${getStatusColor()} capitalize`}>
              {data.status}
            </Badge>
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{data.title}</h3>
          {data.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2 hover:line-clamp-none">
              {data.description}
            </p>
          )}
        </div>
        {data.details && (
          <div className="pt-2 border-t border-gray-100">
            <ul className="text-xs text-gray-500 space-y-1">
              {Object.entries(data.details).map(([key, value]) => (
                <li key={key} className="flex items-center space-x-2">
                  <span className="font-medium">{key}:</span>
                  <span>{String(value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const CareerFlow: React.FC<CareerFlowProps> = ({ initialNodes, initialEdges }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);
  const [layout, setLayout] = useState<'clustered' | 'roadpath'>('clustered');
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // Clustered layout using D3 force simulation
  const applyClusteredLayout = useCallback(() => {
    const simulation = d3.forceSimulation<SimulationNode>()
      .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
      .force('charge', d3.forceManyBody().strength(-1000))
      .force('collision', d3.forceCollide().radius(150))
      .force('group', d3.forceX((d: any) => {
        // Create three groups based on node type
        if (d.data.type === 'start') return window.innerWidth * 0.2;
        if (d.data.type === 'goal') return window.innerWidth * 0.8;
        return window.innerWidth * 0.5;
      }).strength(0.5));

    const nodeObjects: SimulationNode[] = nodes.map(node => ({
      ...node,
      x: node.position.x,
      y: node.position.y,
    }));

    simulation.nodes(nodeObjects).on('tick', () => {
      setNodes(nodes.map((node, i) => ({
        ...node,
        position: {
          x: nodeObjects[i].x ?? node.position.x,
          y: nodeObjects[i].y ?? node.position.y,
        },
      })));
    });

    simulation.alpha(1).restart();
    setTimeout(() => simulation.stop(), 2000);
  }, [nodes, setNodes]);

  // Road path layout
  const applyRoadPathLayout = useCallback(() => {
    const startNode = nodes.find(n => n.data.type === 'start');
    const goalNode = nodes.find(n => n.data.type === 'goal');
    const otherNodes = nodes.filter(n => n.data.type !== 'start' && n.data.type !== 'goal');

    const newNodes = [];
    const spacing = {
      x: window.innerWidth / (otherNodes.length + 3),
      y: window.innerHeight / 4,
    };

    // Position start node
    if (startNode) {
      newNodes.push({
        ...startNode,
        position: { x: spacing.x, y: window.innerHeight / 2 }
      });
    }

    // Position middle nodes in a slight S-curve
    otherNodes.forEach((node, i) => {
      const progress = (i + 1) / (otherNodes.length + 1);
      const curve = Math.sin(progress * Math.PI) * spacing.y;
      
      newNodes.push({
        ...node,
        position: {
          x: spacing.x * (i + 2),
          y: (window.innerHeight / 2) + curve
        }
      });
    });

    // Position goal node
    if (goalNode) {
      newNodes.push({
        ...goalNode,
        position: {
          x: spacing.x * (otherNodes.length + 2),
          y: window.innerHeight / 2
        }
      });
    }

    setNodes(newNodes);
  }, [nodes, setNodes]);

  // Apply initial clustered layout
  useLayoutEffect(() => {
    applyClusteredLayout();
  }, []);

  const toggleLayout = () => {
    if (layout === 'clustered') {
      setLayout('roadpath');
      applyRoadPathLayout();
    } else {
      setLayout('clustered');
      applyClusteredLayout();
    }
  };

  return (
    <div className="relative w-full h-[800px] bg-gradient-to-br from-gray-50 to-white rounded-xl border shadow-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        attributionPosition="bottom-right"
        onNodeClick={onNodeClick}
      >
        <Background color="#94a3b8" gap={32} size={1} />
        <Controls showInteractive={false} />
        <MiniMap 
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'completed': return '#22c55e';
              case 'current': return '#3b82f6';
              default: return '#94a3b8';
            }
          }}
          maskColor="#ffffff50"
        />
        <Panel position="top-right" className="space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleLayout}
            className="bg-white/80 backdrop-blur-sm"
            title={layout === 'clustered' ? 'Switch to Road Path' : 'Switch to Clustered'}
          >
            {layout === 'clustered' ? 
              <Route className="h-4 w-4" /> : 
              <GitBranch className="h-4 w-4" />
            }
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => zoomIn()}
            className="bg-white/80 backdrop-blur-sm"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => zoomOut()}
            className="bg-white/80 backdrop-blur-sm"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fitView()}
            className="bg-white/80 backdrop-blur-sm"
            title="Fit View"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </Panel>
      </ReactFlow>
      
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border max-w-2xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-gray-900">{selectedNode.data.title}</h4>
              </div>
              <p className="mt-1 text-sm text-gray-500">{selectedNode.data.description}</p>
              {selectedNode.data.details && (
                <div className="mt-2 grid grid-cols-2 gap-4">
                  {Object.entries(selectedNode.data.details).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-medium text-gray-700">{key}:</span>{' '}
                      <span className="text-gray-600">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const FlowWithProvider: React.FC<CareerFlowProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CareerFlow initialNodes={props.initialNodes} initialEdges={props.initialEdges} />
    </ReactFlowProvider>
  );
};

export default FlowWithProvider;
