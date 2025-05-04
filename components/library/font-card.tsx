"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Download,
  MoreHorizontal,
  Copy,
  Trash2,
  Info,
  CheckSquare2,
  Square,
  HeartOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Font {
  id: string;
  name: string;
  family: string;
  foundry: string;
  variable: boolean;
  weights: string[];
  styles: string[];
  tags: string[];
  license: string;
  uploaded: string;
  previewText: string;
  previewImage: string | null;
}

interface FontCardProps {
  font: Font;
  previewText: string;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
}

export function FontCard({ font, previewText, isSelected, onSelect, onDeselect }: FontCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [weight, setWeight] = useState(400);
  const [slant, setSlant] = useState(0);
  
  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };
  
  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      onDeselect();
    } else {
      onSelect();
    }
  };
  
  const formatUploadDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card 
        className={`overflow-hidden transition-all duration-200 ${
          isSelected ? 'ring-2 ring-primary' : ''
        }`}
      >
        <div className="relative">
          {/* Preview area */}
          <Dialog>
            <DialogTrigger asChild>
              <div 
                className="p-6 pt-8 pb-14 bg-muted cursor-pointer flex items-center justify-center min-h-[150px]"
                style={{ 
                  fontFamily: font.name, 
                  fontWeight: weight,
                  fontStyle: slant > 0 ? 'italic' : 'normal',
                }}
              >
                <div className="text-xl text-center leading-relaxed line-clamp-3">
                  {previewText}
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Font Preview: {font.name}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="preview">
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="specs">Specifications</TabsTrigger>
                  {font.variable && <TabsTrigger value="variables">Variables</TabsTrigger>}
                </TabsList>
                <TabsContent value="preview" className="space-y-6">
                  <div className="space-y-4">
                    <div 
                      className="p-6 bg-muted rounded-md"
                      style={{ 
                        fontFamily: font.name,
                        fontWeight: weight,
                        fontStyle: slant > 0 ? 'italic' : 'normal',
                      }}
                    >
                      <p className="text-4xl mb-4">{previewText}</p>
                      <p className="text-2xl mb-4">{previewText}</p>
                      <p className="text-xl mb-4">{previewText}</p>
                      <p className="text-base mb-4">{previewText}</p>
                      <p className="text-sm">{previewText}</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Weight</span>
                          <span className="text-sm font-medium">{weight}</span>
                        </div>
                        <Slider 
                          min={100} 
                          max={900} 
                          step={100} 
                          value={[weight]} 
                          onValueChange={(value) => setWeight(value[0])} 
                        />
                      </div>
                      
                      {font.styles.includes("Italic") && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Slant</span>
                            <span className="text-sm font-medium">{slant > 0 ? "Italic" : "Normal"}</span>
                          </div>
                          <Slider 
                            min={0} 
                            max={1} 
                            step={1} 
                            value={[slant]} 
                            onValueChange={(value) => setSlant(value[0])} 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="specs" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Foundry</h4>
                      <p className="text-sm text-muted-foreground">{font.foundry}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Classification</h4>
                      <p className="text-sm text-muted-foreground">{font.family}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Weights</h4>
                      <p className="text-sm text-muted-foreground">{font.weights.join(", ")}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Styles</h4>
                      <p className="text-sm text-muted-foreground">{font.styles.join(", ")}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Variable</h4>
                      <p className="text-sm text-muted-foreground">{font.variable ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">License</h4>
                      <p className="text-sm text-muted-foreground">{font.license}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Upload Date</h4>
                      <p className="text-sm text-muted-foreground">{formatUploadDate(font.uploaded)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {font.tags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                {font.variable && (
                  <TabsContent value="variables" className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Weight</span>
                          <span className="text-sm font-medium">{weight}</span>
                        </div>
                        <Slider 
                          min={100} 
                          max={900} 
                          step={100} 
                          value={[weight]} 
                          onValueChange={(value) => setWeight(value[0])} 
                        />
                      </div>
                      
                      {font.styles.includes("Italic") && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Slant</span>
                            <span className="text-sm font-medium">{slant > 0 ? "Italic" : "Normal"}</span>
                          </div>
                          <Slider 
                            min={0} 
                            max={1} 
                            step={1} 
                            value={[slant]} 
                            onValueChange={(value) => setSlant(value[0])} 
                          />
                        </div>
                      )}
                      
                      {/* Additional variable axes would be displayed here if available */}
                      <div className="p-6 mt-4 bg-muted rounded-md">
                        <div 
                          className="text-2xl"
                          style={{ 
                            fontFamily: font.name,
                            fontWeight: weight,
                            fontStyle: slant > 0 ? 'italic' : 'normal',
                          }}
                        >
                          {previewText}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </DialogContent>
          </Dialog>
          
          {/* Selection checkbox */}
          <div
            className={`absolute top-2 left-2 cursor-pointer transition-opacity ${
              isHovered || isSelected ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleSelect}
          >
            {isSelected ? (
              <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <CheckSquare2 className="h-4 w-4" />
              </div>
            ) : (
              <div className="h-6 w-6 rounded-md border border-muted-foreground/40 bg-background/90 flex items-center justify-center hover:border-primary transition-colors">
                <Square className="h-4 w-4" />
              </div>
            )}
          </div>
          
          {/* Quick actions */}
          <div
            className={`absolute bottom-0 left-0 right-0 flex justify-between items-center p-2 bg-background/80 backdrop-blur-sm transition-opacity ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleFavorite}
            >
              {isFavorite ? (
                <Heart className="h-4 w-4 fill-destructive text-destructive" />
              ) : (
                <Heart className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy Preview</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Info className="mr-2 h-4 w-4" />
                    <span>View Details</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    {isFavorite ? (
                      <>
                        <HeartOff className="mr-2 h-4 w-4" />
                        <span>Remove from Favorites</span>
                      </>
                    ) : (
                      <>
                        <Heart className="mr-2 h-4 w-4" />
                        <span>Add to Favorites</span>
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-medium text-lg truncate">{font.name}</h3>
              <p className="text-muted-foreground text-sm">{font.foundry}</p>
            </div>
            {font.variable && (
              <Badge variant="outline" className="text-xs">Variable</Badge>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1 mt-3">
            {font.tags.slice(0, 2).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {font.tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{font.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}