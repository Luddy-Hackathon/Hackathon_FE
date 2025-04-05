import { Metadata } from "next";
import CourseCard from "@/components/courses/CourseCard";
import FilterBar from "@/components/courses/FilterBar";

export const metadata: Metadata = {
  title: "Course Recommendations | Smart Course Selector",
  description: "Find courses that match your career goals and skills",
};

// Sample course data
const courses = [
  {
    id: 1,
    title: "Introduction to Data Science",
    institution: "Stanford University",
    description: "Learn the fundamentals of data science, including data collection, analysis, and visualization. Perfect for beginners.",
    tags: ["Computer Science", "Analytics", "Beginner"],
    credits: 4,
    careerFit: 92,
    skillsMatch: 85,
    timeAvailability: 78,
  },
  {
    id: 2,
    title: "Machine Learning Fundamentals",
    institution: "MIT",
    description: "A comprehensive introduction to machine learning algorithms and their applications in real-world scenarios.",
    tags: ["AI", "Computer Science", "Algorithms"],
    credits: 3,
    careerFit: 84,
    skillsMatch: 76,
    timeAvailability: 65,
  },
  {
    id: 3,
    title: "Web Development Bootcamp",
    institution: "UC Berkeley",
    description: "Intensive course covering front-end and back-end web development technologies and frameworks.",
    tags: ["Web", "JavaScript", "Full Stack"],
    credits: 5,
    careerFit: 72,
    skillsMatch: 88,
    timeAvailability: 58,
  },
];

export default function Home() {
  return (
    <div className="container mx-auto p-6 pt-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-6">Course Recommendations</h1>
        <FilterBar />
      </div>

      <div className="space-y-6">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            title={course.title}
            institution={course.institution}
            description={course.description}
            tags={course.tags}
            credits={course.credits}
            careerFit={course.careerFit}
            skillsMatch={course.skillsMatch}
            timeAvailability={course.timeAvailability}
          />
        ))}
      </div>
    </div>
  );
}
