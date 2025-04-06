"use client";
import { useEffect, useState } from "react";
import { Node, Edge } from "reactflow";
import CareerFlow from "@/components/CareerFlow";
import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from "@/components/auth/AuthProvider";
import { MessageLoading } from "./ui/message-loading";

interface RoadmapProps {
  careerGoal: string;
  currentCourses: string[];
  creditsCompleted: number;
}

const Roadmap = ({ careerGoal, currentCourses, creditsCompleted }: RoadmapProps) => {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoadmap = async () => {
      if (!user) return;
      
      setLoading(true);

      // 1. Fetch student profile
      const { data: profile, error: profileErr } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileErr || !profile) return;

      // 2. Fetch course data
      const { data: allCourses } = await supabase.from("courses").select("*");

      if (!allCourses) return;

      // 3. Generate with Gemini
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
Generate a roadmap for a student aiming to be a ${profile.career_goal_id}.
Based on these courses: ${allCourses.map(c => c.name).join(", ")}.

Return a JSON array of steps in this exact format:
[
  {
    "title": "Step title",
    "type": "course/project/internship/start/goal",
    "description": "Step description"
  }
]

Do not include any text before or after the JSON array.`;

      const response = await model.generateContent(prompt);
      const raw = response.response.text()
        .replace(/```json|```|\n/g, "")
        .trim();
        
      try {
        const steps = JSON.parse(raw);
        if (!Array.isArray(steps)) {
          throw new Error('Response is not an array');
        }

        const newNodes: Node[] = steps.map((step: any, i: number) => {
          // Calculate position in a curved path
          const angle = (i / (steps.length - 1)) * Math.PI;
          const radius = 400;
          const x = 500 + radius * Math.cos(angle);
          const y = 350 + radius * Math.sin(angle) * 0.5;

          return {
            id: `node-${i}`,
            type: "custom",
            data: {
              title: step.title,
              description: step.description,
              type: step.type,
              status: i === 0 ? 'completed' : i === 1 ? 'current' : 'upcoming',
              details: {
                Duration: step.type === 'course' ? '3 months' : step.type === 'internship' ? '6 months' : '-',
                Difficulty: step.type === 'course' ? 'Intermediate' : '-',
                Prerequisites: step.prerequisites?.join(', ') || 'None'
              }
            },
            position: { x, y },
            style: {
              opacity: 1,
              transition: 'all 0.3s ease'
            }
          };
        });

        const newEdges: Edge[] = newNodes.slice(1).map((_, i) => ({
          id: `edge-${i}`,
          source: `node-${i}`,
          target: `node-${i + 1}`,
          animated: true,
          type: 'smoothstep',
          style: { 
            stroke: '#94a3b8', 
            strokeWidth: 2,
            opacity: 0.8
          }
        }));

        setNodes(newNodes);
        setEdges(newEdges);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing response:', error);
        setLoading(false);
      }
    };

    loadRoadmap();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
          <div className="flex items-center space-x-2">
            <MessageLoading />
            <span className="text-sm text-gray-500">Generating your roadmap...</span>
          </div>
        </div>
        <div className="relative w-full h-[800px] bg-gradient-to-br from-gray-50 to-white rounded-xl border shadow-sm overflow-hidden">
          {/* Loading overlay */}
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <MessageLoading className="h-12 w-12" />
            </div>
          </div>
          
          {/* Background grid */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2U1ZTVlNSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')]"></div>
          
          {/* Skeleton nodes with connecting edges */}
          <div className="relative w-full h-full">
            {/* Start Node */}
            <div className="absolute top-1/4 left-1/4">
              <div className="w-[250px] bg-white p-4 rounded-lg shadow-lg border-2 border-green-500">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="mt-2 flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-2 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Middle Node */}
            <div className="absolute top-1/2 left-1/2">
              <div className="w-[250px] bg-white p-4 rounded-lg shadow-lg border-2 border-blue-500">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="mt-2 flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-2 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* End Node */}
            <div className="absolute bottom-1/4 right-1/4">
              <div className="w-[250px] bg-white p-4 rounded-lg shadow-lg border-2 border-purple-500">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="mt-2 flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-2 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Connecting Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* First Edge */}
              <path
                d="M 25% 25% Q 50% 25%, 50% 50%"
                stroke="#94a3b8"
                strokeWidth="2"
                fill="none"
                strokeDasharray="5,5"
                className="animate-[dash_1s_linear_infinite]"
              />
              <path
                d="M 25% 25% Q 50% 25%, 50% 50%"
                stroke="#3b82f6"
                strokeWidth="2"
                fill="none"
                className="animate-[dash_1s_linear_infinite]"
                style={{ strokeDasharray: '5,5', strokeDashoffset: '5' }}
              />
              
              {/* Second Edge */}
              <path
                d="M 50% 50% Q 75% 50%, 75% 75%"
                stroke="#94a3b8"
                strokeWidth="2"
                fill="none"
                strokeDasharray="5,5"
                className="animate-[dash_1s_linear_infinite]"
              />
              <path
                d="M 50% 50% Q 75% 50%, 75% 75%"
                stroke="#3b82f6"
                strokeWidth="2"
                fill="none"
                className="animate-[dash_1s_linear_infinite]"
                style={{ strokeDasharray: '5,5', strokeDashoffset: '5' }}
              />
            </svg>
          </div>
          
          {/* Skeleton controls */}
          <div className="absolute top-4 right-4 flex space-x-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
          </div>
          
          {/* Skeleton minimap */}
          <div className="absolute bottom-4 right-4 w-32 h-32 bg-gray-200 rounded-lg animate-pulse">
            <div className="absolute inset-2 bg-white/50 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Career Roadmap</h1>
      <CareerFlow initialNodes={nodes} initialEdges={edges} />
    </div>
  );
};

export default Roadmap;