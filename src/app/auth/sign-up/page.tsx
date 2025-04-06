import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign Up | EduMuse",
  description: "Create your EduMuse account",
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-4">
      <div className="max-w-md w-full space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-black">EduMuse</h1>
              <p className="text-sm text-zinc-600 mt-1">Your AI-powered learning companion</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-center">Create your account</h2>
          <p className="text-zinc-600 text-center mt-2">
            Start your personalized learning journey
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="shadow-lg border-zinc-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Sign Up</CardTitle>
              <CardDescription>
                Create your account to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="name">
                    Full Name
                  </label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    type="text"
                    autoComplete="name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="email">
                    Email
                  </label>
                  <Input
                    id="email"
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="email"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="confirm-password">
                    Confirm Password
                  </label>
                  <Input
                    id="confirm-password"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                    className="h-10"
                  />
                </div>
                <Button className="w-full h-10" asChild>
                  <Link href="/">Create Account</Link>
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex justify-center">
              <div className="text-sm text-zinc-500">
                Already have an account?{" "}
                <Link
                  href="/auth/sign-in"
                  className="text-primary font-medium hover:text-primary/80 transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
} 