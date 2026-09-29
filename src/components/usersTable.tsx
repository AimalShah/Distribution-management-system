"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Select } from "@/components/ui/select";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "./ui/badge";

/**
 * Shape of `getOrganizationUser()` in src/actions/user: a user row from the
 * `user` table plus its sessions.
 */
interface OrganizationUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  sessions: { createdAt: Date }[];
}

export default function UsersTable({ users }: { users: OrganizationUser[] }) {
  const [selectedRole, setSelectedRole] = useState("All");
  const filteredUsers = users.filter((user) =>
    selectedRole === "All" ? true : user.role === selectedRole
  );
  const roles = Array.from(new Set(users.map((user) => user.role))).filter(
    (role): role is string => role !== null
  );
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Active":
        return (
          <Badge variant="default" className="bg-green-500">
            {status}
          </Badge>
        );
      case "Banned":
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "adminRole":
        return <Badge variant="destructive">{role}</Badge>;
      case "member":
        return <Badge variant="secondary">{role}</Badge>;
      default:
        return <Badge variant="default">{role}</Badge>;
    }
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-8" />
        </div>

        <Select onValueChange={setSelectedRole} defaultValue="All">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers && filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={user.image || "/placeholder.svg"}
                            alt={user.name || "User"}
                          />
                          <AvatarFallback>
                            {user.name
                              ? user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                              : "NA"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {user.name || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email || "No email"}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {getStatusBadge(
                        user.banned === null ? "Active" : "Banned"
                      )}
                    </TableCell>
                    <TableCell>
                      {user.sessions && user.sessions.length > 0
                        ? format(
                            new Date(
                              user.sessions[user.sessions.length - 1].createdAt
                            ),
                            "PPpp"
                          )
                        : "No sessions yet"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
