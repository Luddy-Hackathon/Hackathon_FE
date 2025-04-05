"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";

export default function FilterBar() {
  return (
    <div className="bg-white p-4 border border-zinc-200 rounded-md flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-500">Subject:</label>
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="cs">Computer Science</SelectItem>
              <SelectItem value="data">Data Science</SelectItem>
              <SelectItem value="web">Web Development</SelectItem>
              <SelectItem value="ai">Artificial Intelligence</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-500">Credit Load:</label>
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="1-2">1-2 Credits</SelectItem>
              <SelectItem value="3-4">3-4 Credits</SelectItem>
              <SelectItem value="5+">5+ Credits</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-500">Time Available:</label>
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="5-10">5-10 hours/week</SelectItem>
              <SelectItem value="10-15">10-15 hours/week</SelectItem>
              <SelectItem value="15+">15+ hours/week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button variant="outline" className="whitespace-nowrap">
        <SlidersHorizontal size={16} className="mr-2" />
        More Filters
      </Button>
    </div>
  );
}
