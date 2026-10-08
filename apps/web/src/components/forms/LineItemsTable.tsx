import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";

export interface LineItemsColumn {
  header: ReactNode;
  headClassName?: string;
  cellClassName?: string;
}

export interface LineItemsTableProps {
  title: string;
  subtitle: ReactNode;
  isEditing?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  columns: LineItemsColumn[];
  rowKeys: string[];
  renderRow: (index: number) => ReactNode[];
  onRemove?: (index: number) => void;
}

export function LineItemsTable({
  title,
  subtitle,
  isEditing = false,
  onAdd,
  addLabel = "Add Item",
  columns,
  rowKeys,
  renderRow,
  onRemove,
}: LineItemsTableProps) {
  return (
    <Card className="rounded-md border border-border shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-3 sm:px-4 sm:py-3 border-b border-border bg-muted/20">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {!isEditing && onAdd && (
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onAdd}>
            <Plus className="size-3.5 mr-1.5" />
            {addLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="[&_td]:py-2 [&_td]:px-3 [&_th]:py-2 [&_th]:px-3 text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                {columns.map((column, columnIndex) => (
                  <TableHead key={columnIndex} className={column.headClassName}>
                    {column.header}
                  </TableHead>
                ))}
                {!isEditing && <TableHead className="w-12 text-center" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowKeys.map((rowKey, index) => (
                <TableRow key={rowKey}>
                  {renderRow(index).map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className={columns[cellIndex]?.cellClassName}
                    >
                      {cell}
                    </TableCell>
                  ))}
                  {!isEditing && (
                    <TableCell className="text-center">
                      {rowKeys.length > 1 && onRemove && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => onRemove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
