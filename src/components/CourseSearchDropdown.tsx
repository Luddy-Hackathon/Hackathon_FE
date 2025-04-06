import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

type Course = {
  id: string;
  title: string;
  subject: string;
  credits: number;
};

type Props = {
  selectedCourses: Course[];
  onCoursesChange: (courses: Course[]) => void;
};

export default function CourseSearchDropdown({ selectedCourses, onCoursesChange }: Props) {
  const [query, setQuery] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const searchCourses = async () => {
      if (!query.trim()) {
        setCourses([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id, title, subject, credits')
          .ilike('title', `%${query}%`)
          .limit(10);

        if (error) throw error;
        setCourses(data || []);
      } catch (error) {
        console.error('Error searching courses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(searchCourses, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query]);

  return (
    <Combobox value={selectedCourses} onChange={onCoursesChange} multiple>
      <div className="relative mt-1">
        <div className="relative w-full">
          <Combobox.Input
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
            onChange={(event) => setQuery(event.target.value)}
            displayValue={(courses: Course[]) =>
              courses.map((course) => course.title).join(', ')
            }
            placeholder="Search for courses..."
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
            <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </Combobox.Button>
        </div>

        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {isLoading && (
            <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
              Searching...
            </div>
          )}
          {courses.length === 0 && query !== '' && !isLoading && (
            <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
              No courses found.
            </div>
          )}
          {courses.map((course) => (
            <Combobox.Option
              key={course.id}
              value={course}
              className={({ active }) =>
                `relative cursor-default select-none py-2 pl-3 pr-9 ${
                  active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                }`
              }
            >
              {({ active, selected }) => (
                <>
                  <div className="flex items-center">
                    <span className="truncate font-medium">{course.title}</span>
                    <span className="ml-2 truncate text-sm text-gray-500">
                      {course.subject} • {course.credits} credits
                    </span>
                  </div>
                  {selected && (
                    <span
                      className={`absolute inset-y-0 right-0 flex items-center pr-4 ${
                        active ? 'text-white' : 'text-indigo-600'
                      }`}
                    >
                      <CheckIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                </>
              )}
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </div>

      {selectedCourses.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedCourses.map((course) => (
            <span
              key={course.id}
              className="inline-flex items-center rounded-full bg-indigo-100 py-0.5 pl-2.5 pr-1 text-sm font-medium text-indigo-700"
            >
              {course.title}
              <button
                type="button"
                onClick={() =>
                  onCoursesChange(selectedCourses.filter((c) => c.id !== course.id))
                }
                className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:bg-indigo-500 focus:text-white focus:outline-none"
              >
                <span className="sr-only">Remove {course.title}</span>×
              </button>
            </span>
          ))}
        </div>
      )}
    </Combobox>
  );
} 