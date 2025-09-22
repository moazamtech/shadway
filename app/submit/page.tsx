"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GradientBackground } from "@/components/gradient-background"
import { ArrowLeft, Send, Globe, Mail, User, Link as LinkIcon, FileText, Tag } from "lucide-react"
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
      <div className="min-h-screen relative flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <Card className="backdrop-blur-sm bg-background/80 border-border/50">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-muted-foreground mb-6">
                Your submission has been received successfully. We'll review it and get back to you soon.
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link href="/">Back to Home</Link>
                </Button>
                <Button onClick={() => setSubmitted(false)}>
                  Submit Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">

      <GradientBackground />
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>

          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-white bg-clip-text text-transparent">
              Submit Your Website
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Share your beautiful Shadcn UI website with our community. Help others discover amazing interfaces and get inspired.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-2xl mx-auto">
          <Card className="backdrop-blur-sm bg-background/80 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Website Submission
              </CardTitle>
              <CardDescription>
                Fill in the details about your website or UI project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Your Name *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="John Doe"
                      required
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="john@example.com"
                      required
                      className="bg-background/50"
                    />
                  </div>
                </div>

                {/* Website Information */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="websiteName" className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Website Name *
                    </Label>
                    <Input
                      id="websiteName"
                      value={formData.websiteName}
                      onChange={(e) => handleInputChange("websiteName", e.target.value)}
                      placeholder="My Awesome UI"
                      required
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Website URL *
                    </Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      value={formData.websiteUrl}
                      onChange={(e) => handleInputChange("websiteUrl", e.target.value)}
                      placeholder="https://myawesomeui.com"
                      required
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Category *
                    </Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category.toLowerCase()}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="githubUrl" className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      GitHub URL (Optional)
                    </Label>
                    <Input
                      id="githubUrl"
                      type="url"
                      value={formData.githubUrl}
                      onChange={(e) => handleInputChange("githubUrl", e.target.value)}
                      placeholder="https://github.com/username/repo"
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Description *
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder="Describe your website, what makes it special, what technologies you used, etc."
                      rows={4}
                      required
                      className="bg-background/50 resize-none"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                    size="lg"
                  >
                    {isSubmitting ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit for Review
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}