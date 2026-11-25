from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlogs.services import record_audit_log
from apps.reports.services import build_dashboard_payload, generate_report_rows, rows_to_csv


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_dashboard_payload(request.user))


class InstitutionalReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_type: str):
        if not (request.user.is_superuser or request.user.has_perm("reports.export_reports")):
            raise PermissionDenied("You do not have permission to access institutional reports.")

        try:
            columns, rows = generate_report_rows(report_type, request.query_params)
        except ValueError as exc:
            return Response(
                {"error": {"code": "invalid_report", "message": str(exc), "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        export_fmt = request.query_params.get("export", "").lower()
        if export_fmt in ("csv", "excel"):
            csv_content = rows_to_csv(columns, rows)
            response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = f'attachment; filename="report_{report_type}.csv"'
            record_audit_log(
                action="export_report",
                module="reports",
                actor=request.user,
                metadata={"report_type": report_type, "row_count": len(rows)},
                request=request,
            )
            return response

        return Response(
            {
                "report_type": report_type,
                "columns": columns,
                "count": len(rows),
                "results": rows,
            }
        )
