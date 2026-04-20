"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Pencil, Trash2 } from "lucide-react"
import { deleteRole } from "@/actions/roles"
import { RoleForm } from "@/components/settings/role-form"
import { toast } from "sonner"

interface RoleRow {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissionCodes: string[]
  userCount: number
}

interface RoleTableProps {
  roles: RoleRow[]
  modules: {
    module: string
    moduleName: string
    permissions: { id: string; code: string; name: string }[]
  }[]
}

export function RoleTable({ roles, modules }: RoleTableProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(roleId: string) {
    startTransition(async () => {
      try {
        await deleteRole(roleId)
        toast.success("Роль удалена")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка удаления")
      }
    })
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Описание</TableHead>
            <TableHead>Права</TableHead>
            <TableHead>Пользователи</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Нет ролей
              </TableCell>
            </TableRow>
          ) : (
            roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <Link href={`/settings/roles/${role.id}`} className="font-medium hover:underline">
                    {role.name}
                  </Link>
                  {role.isSystem && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      Системная
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {role.description || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {role.permissionCodes.length} прав
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{role.userCount}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RoleForm
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Pencil className="size-4" />
                        </Button>
                      }
                      role={{
                        id: role.id,
                        name: role.name,
                        description: role.description,
                        permissionCodes: role.permissionCodes,
                        isSystem: role.isSystem,
                      }}
                      modules={modules}
                    />
                    {!role.isSystem && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="sm">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Удалить роль &laquo;{role.name}&raquo;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Это действие необратимо. Роль будет удалена навсегда.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(role.id)}
                              disabled={isPending}
                            >
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
