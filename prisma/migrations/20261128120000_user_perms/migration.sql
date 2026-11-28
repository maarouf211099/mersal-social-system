-- صلاحيات مخصصة لكل موظف (فاضي = صلاحيات الدور)
ALTER TABLE "User" ADD COLUMN "perms" JSONB;
