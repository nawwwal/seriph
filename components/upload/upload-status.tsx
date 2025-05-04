"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type UploadJob = {
  id: string;
  name: string;
  status: "processing" | "complete" | "failed";
  progress: number;
  startTime: Date;
};

export function UploadStatus() {
  // Mock data for demonstration
  const [jobs, setJobs] = useState<UploadJob[]>([
    {
      id: "1",
      name: "Helvetica-Bold.otf",
      status: "complete",
      progress: 100,
      startTime: new Date(Date.now() - 3600000),
    },
    {
      id: "2",
      name: "Inter-Variable.ttf",
      status: "processing",
      progress: 65,
      startTime: new Date(),
    },
    {
      id: "3",
      name: "Roboto-Regular.ttf",
      status: "complete",
      progress: 100,
      startTime: new Date(Date.now() - 7200000),
    },
  ]);

  // Simulate progress updates
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prev => 
        prev.map(job => {
          if (job.status === "processing" && job.progress < 100) {
            return {
              ...job,
              progress: job.progress + 5,
              status: job.progress + 5 >= 100 ? "complete" : "processing"
            };
          }
          return job;
        })
      );
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Uploads</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent uploads
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 truncate">
                    {job.status === "complete" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : job.status === "processing" ? (
                      <Clock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="truncate font-medium">{job.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {job.status === "complete" 
                      ? "Complete" 
                      : job.status === "processing" 
                        ? `${job.progress}%`
                        : "Failed"}
                  </span>
                </div>
                {job.status === "processing" && (
                  <Progress value={job.progress} className="h-1" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}