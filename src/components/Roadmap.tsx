"use client";
import { useEffect, useState } from "react";
import { Node, Edge } from "reactflow";
import CareerFlow from "@/components/CareerFlow";
import { supabase } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from "@/components/auth/AuthProvider";

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

  if (loading) return <p className="text-center mt-10">Loading roadmap...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Career Roadmap</h1>
      <CareerFlow initialNodes={nodes} initialEdges={edges} />
    </div>
  );
};

export default Roadmap;