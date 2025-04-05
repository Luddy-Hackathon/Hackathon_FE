"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookmarkIcon, GraduationCap, MessageSquare } from "lucide-react";

interface CourseCardProps {
  title: string;
  institution: string;
  description: string;
  tags: string[];
  credits: number;
  careerFit: number;
  skillsMatch: number;
  timeAvailability: number;
}

export default function CourseCard({
  title,
  institution,
  description,
  tags,
  credits,
  careerFit,
  skillsMatch,
  timeAvailability,
}: CourseCardProps) {
  // Calculate overall match percentage (average of all match criteria)
  const overallMatch = Math.round(
    (careerFit + skillsMatch + timeAvailability) / 3
  );

  // Determine match strength label
  const getMatchStrength = (percentage: number) => {
    if (percentage >= 85) return "STRONG MATCH";
    if (percentage >= 70) return "GOOD MATCH";
    return "MODERATE MATCH";
  };

  const matchStrength = getMatchStrength(overallMatch);

  return (
    <Card className="border border-zinc-200 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div className="p-6 flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-zinc-500 text-sm">{institution}</p>
              </div>
              <div className="bg-zinc-100 px-3 py-1 rounded-md text-sm">
                {credits} credits
              </div>
            </div>
            <p className="mt-4 text-zinc-700">{description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="p-6 border-t md:border-t-0 md:border-l border-zinc-200 w-full md:w-64 flex flex-col justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-zinc-900">{overallMatch}%</div>
              <div className="text-xs font-semibold text-zinc-500 mb-4">
                {matchStrength}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Career Fit</span>
                  <span>{careerFit}%</span>
                </div>
                <Progress value={careerFit} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Skills Match</span>
                  <span>{skillsMatch}%</span>
                </div>
                <Progress value={skillsMatch} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Time Availability</span>
                  <span>{timeAvailability}%</span>
                </div>
                <Progress value={timeAvailability} className="h-2" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between p-4 bg-white border-t border-zinc-200">
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare size={16} />
          Ask AI Why
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <BookmarkIcon size={16} />
            Save
          </Button>
          <Button size="sm" className="gap-2">
            <GraduationCap size={16} />
            Enroll
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
