"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Send, Globe, Mail, User, Link as LinkIcon, FileText, Tag, CheckCircle } from "lucide-react"
import Link from "next/link"

interface SubmissionData {
  name: string
  email: string
  websiteName: string
  websiteUrl: string
  description: string
  category: string
  githubUrl?: string
}

export default function SubmitPage() {
  const [formData, setFormData] = useState<SubmissionData>({
    name: "",
    email: "",
    websiteName: "",
    websiteUrl: "",
    description: "",
    category: "",
    githubUrl: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const categories = [
    "Components",
    "Dev Tools",
    "Theme",
    "Portfolio",
    "Blog",
    "SaaS",
    "App",
    "Documentation",
    "Other"
  ]

  const handleInputChange = (field: keyof SubmissionData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitted(true)
        setFormData({
          name: "",
          email: "",
          websiteName: "",
          websiteUrl: "",
          description: "",
          category: "",
          githubUrl: ""
        })
      }
    } catch (error) {
      console.error("Submission error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 pt-32">
          <div className="w-full max-w-lg text-center">
            <Card className="backdrop-blur-xl bg-background/80 border-border/30 shadow-2xl rounded-2xl">
              <CardContent className="pt-12 pb-10 px-8">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>

                <h2 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Thank You!
                </h2>

                <p className="text-muted-foreground mb-10 text-base sm:text-lg leading-relaxed">
                  Your submission has been received successfully. We'll review it and get back to you soon.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild variant="outline" className="flex-1 sm:flex-none backdrop-blur-sm hover:bg-background/80 transition-all duration-300">
                    <Link href="/">Back to Home</Link>
                  </Button>
                  <Button
                    onClick={() => setSubmitted(false)}
                    className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 transition-all duration-300"
                  >
                    Submit Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
     
     
      <Navbar />

      <div className="relative z-10">
        <div className="relative flex flex-col justify-start items-center w-full">
          <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
            {/* Left vertical line */}
            <div className="hidden sm:block w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border/30 z-0"></div>
            {/* Right vertical line */}
            <div className="hidden sm:block w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border/30 z-0"></div>

            {/* Left decorative dashed border - outside of main lines */}
            <div
              className="absolute dark:opacity-[0.15] opacity-[0.2] left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
              }}
            ></div>

            {/* Right decorative dashed border - outside of main lines */}
            <div
              className="absolute dark:opacity-[0.15] opacity-[0.2] right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
              }}
            ></div>

            <div className="self-stretch flex flex-col items-center relative z-10 pt-32 pb-20">
              <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">

                {/* Header Section */}
                <div className="text-center mb-16">
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                    Submit Your Website
                  </h1>

                  <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    Share your beautiful Shadcn UI website with our community. Help others discover amazing interfaces and get inspired by modern design.
                  </p>
                </div>

                {/* Form Section */}
                <div className="max-w-3xl mx-auto">
                  <Card className="backdrop-blur-xl bg-background/60 border-border/30 shadow-2xl rounded-2xl overflow-hidden">
                    <CardHeader className="text-center p-8 bg-background/20">
                      <CardTitle className="flex items-center justify-center gap-3 text-2xl sm:text-3xl font-bold mb-3">
                        <Globe className="w-8 h-8 text-primary" />
                        Website Submission
                      </CardTitle>
                      <CardDescription className="text-base sm:text-lg text-muted-foreground">
                        Fill in the details about your website or UI project
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-8 sm:p-10">
                      <form onSubmit={handleSubmit} className="space-y-8">

                        {/* Personal Information */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                              <User className="w-4 h-4 text-primary" />
                              Your Name *
                            </Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => handleInputChange("name", e.target.value)}
                              placeholder="John Doe"
                              required
                              className="h-12 backdrop-blur-sm bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-xl"
                            />
                          </div>

                          <div className="space-y-3">
                            <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                              <Mail className="w-4 h-4 text-primary" />
                              Email Address *
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => handleInputChange("email", e.target.value)}
                              placeholder="john@example.com"
                              required
                              className="h-12 backdrop-blur-sm bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-xl"
                            />
                          </div>
                        </div>

                        {/* Website Information */}
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <Label htmlFor="websiteName" className="flex items-center gap-2 text-sm font-medium">
                              <Globe className="w-4 h-4 text-primary" />
                              Website Name *
                            </Label>
                            <Input
                              id="websiteName"
                              value={formData.websiteName}
                              onChange={(e) => handleInputChange("websiteName", e.target.value)}
                              placeholder="My Awesome UI"
                              required
                              className="h-12 backdrop-blur-sm bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-xl"
                            />
                          </div>

                          <div className="space-y-3">
                            <Label htmlFor="websiteUrl" className="flex items-center gap-2 text-sm font-medium">
                              <LinkIcon className="w-4 h-4 text-primary" />
                              Website URL *
                            </Label>
                            <Input
                              id="websiteUrl"
                              type="url"
                              value={formData.websiteUrl}
                              onChange={(e) => handleInputChange("websiteUrl", e.target.value)}
                              placeholder="https://myawesomeui.com"
                              required
                              className="h-12 backdrop-blur-sm bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-xl"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <Label htmlFor="category" className="flex items-center gap-2 text-sm font-medium">
                                <Tag className="w-4 h-4 text-primary" />
                                Category *
                              </Label>
                              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                                <SelectTrigger className="h-12 backdrop-blur-sm bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-xl">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent className="backdrop-blur-xl bg-background/95 border-border/50 rounded-xl">
                                  {categories.map((category) => (
                                    <SelectItem key={category} value={category.toLowerCase()} className="rounded-lg">
                                      {category}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-3">
                              <Label htmlFor="githubUrl" className="flex items-center gap-2 text-sm font-medium">
                                <LinkIcon className="w-4 h-4 text-primary" />
                                GitHub URL (Optional)
                              </Label>
                              <Input
                                id="githubUrl"
                                type="url"
                                value={formData.githubUrl}
                                onChange={(e) => handleInputChange("githubUrl", e.target.value)}
                                placeholder="https://github.com/username/repo"
                                className="h-12 backdrop-blur-sm bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-xl"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label htmlFor="description" className="flex items-center gap-2 text-sm font-medium">
                              <FileText className="w-4 h-4 text-primary" />
                              Description *
                            </Label>
                            <Textarea
                              id="description"
                              value={formData.description}
                              onChange={(e) => handleInputChange("description", e.target.value)}
                              placeholder="Describe your website, what makes it special, what technologies you used, etc."
                              rows={5}
                              required
                              className="backdrop-blur-sm bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 rounded-xl resize-none"
                            />
                          </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-6">
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl"
                          >
                            {isSubmitting ? (
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                Submitting...
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <Send className="w-5 h-5" />
                                Submit for Review
                              </div>
                            )}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}