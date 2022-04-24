#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>
#include <strsafe.h>
#include <TlHelp32.h>
// #include <winternl.h>
#endif

#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include "process.h"

static const char* errmsgs[] = {
  "",
  "Invalid argument",
  "Process is not found",
  "Windows API Error",
  "Unsupported platform",
};

const char* prc_err(prc_result code) {
  return errmsgs[code];
}

#ifdef _WIN32

uint32_t prc_get_sys_err() {
  return GetLastError();
}

void prc_free_sys_err_msg(uint16_t* msg) {
  LocalFree(msg);
}

prc_result prc_get_sys_err_msg(uint16_t** msg) {
  DWORD code = prc_get_sys_err();
  if (FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM |
                     FORMAT_MESSAGE_IGNORE_INSERTS |
                     FORMAT_MESSAGE_ALLOCATE_BUFFER,
                     NULL,
                     code,
                     GetSystemDefaultLangID(),
                     (LPWSTR) msg,
                     0,
                     NULL)) {
    return prc_ok;
  }
  return prc_system_error;
}

prc_result prc_is_process_running(uint32_t pid, bool* out) {
  if (out == NULL) return prc_invalid_arg;
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (INVALID_HANDLE_VALUE == snap) return prc_system_error;
  PROCESSENTRY32W pe32;
  ZeroMemory(&pe32, sizeof(PROCESSENTRY32W));
  pe32.dwSize = sizeof(PROCESSENTRY32W);
  if (Process32FirstW(snap, &pe32)) {
    if (pid == pe32.th32ProcessID) {
      *out = true;
      CloseHandle(snap);
      return prc_ok;
    }
    while (Process32NextW(snap, &pe32)) {
      if (pid == pe32.th32ProcessID) {
        *out = true;
        CloseHandle(snap);
        return prc_ok;
      }
    }
  }
  *out = false;
  return prc_ok;
}

prc_result prc_get_process_id_by_name(const uint16_t* name, uint32_t* pid) {
  if (name == NULL || pid == NULL) return prc_invalid_arg;
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (INVALID_HANDLE_VALUE == snap) return prc_system_error;
  PROCESSENTRY32W pe32;
  ZeroMemory(&pe32, sizeof(PROCESSENTRY32W));
  pe32.dwSize = sizeof(PROCESSENTRY32W);
  if (Process32FirstW(snap, &pe32)) {
    if (CSTR_EQUAL == CompareStringEx(LOCALE_NAME_SYSTEM_DEFAULT,
        NORM_IGNORECASE, name, -1, pe32.szExeFile, -1,
        NULL, NULL, 0)) {
      *pid = pe32.th32ProcessID;
      CloseHandle(snap);
      return prc_ok;
    }
    while (Process32NextW(snap, &pe32)) {
      if (CSTR_EQUAL == CompareStringEx(LOCALE_NAME_SYSTEM_DEFAULT,
          NORM_IGNORECASE, name, -1, pe32.szExeFile, -1,
          NULL, NULL, 0)) {
        *pid = pe32.th32ProcessID;
        CloseHandle(snap);
        return prc_ok;
      }
    }
  }
  CloseHandle(snap);
  return prc_process_not_found;
}

typedef enum _PROCESSINFOCLASS {
    ProcessBasicInformation = 0,
    ProcessDebugPort = 7,
    ProcessWow64Information = 26,
    ProcessImageFileName = 27,
    ProcessBreakOnTermination = 29
} PROCESSINFOCLASS;

typedef __kernel_entry LONG  (NTAPI *NtQueryInformationProcess_t)(
  HANDLE           ProcessHandle,
  PROCESSINFOCLASS ProcessInformationClass,
  PVOID            ProcessInformation,
  ULONG            ProcessInformationLength,
  PULONG           ReturnLength
);

typedef struct _UNICODE_STRING {
    USHORT Length;
    USHORT MaximumLength;
    PWSTR  Buffer;
} UNICODE_STRING;
typedef UNICODE_STRING *PUNICODE_STRING;
typedef const UNICODE_STRING *PCUNICODE_STRING;

typedef struct _RTL_USER_PROCESS_PARAMETERS {
    BYTE Reserved1[16];
    PVOID Reserved2[10];
    UNICODE_STRING ImagePathName;
    UNICODE_STRING CommandLine;
} RTL_USER_PROCESS_PARAMETERS, *PRTL_USER_PROCESS_PARAMETERS;

typedef VOID (NTAPI *PPS_POST_PROCESS_INIT_ROUTINE)(VOID);

typedef struct _PEB_LDR_DATA {
    BYTE Reserved1[8];
    PVOID Reserved2[3];
    LIST_ENTRY InMemoryOrderModuleList;
} PEB_LDR_DATA, *PPEB_LDR_DATA;

typedef struct _PEB {
    BYTE Reserved1[2];
    BYTE BeingDebugged;
    BYTE Reserved2[1];
    PVOID Reserved3[2];
    PPEB_LDR_DATA Ldr;
    PRTL_USER_PROCESS_PARAMETERS ProcessParameters;
    PVOID Reserved4[3];
    PVOID AtlThunkSListPtr;
    PVOID Reserved5;
    ULONG Reserved6;
    PVOID Reserved7;
    ULONG Reserved8;
    ULONG AtlThunkSListPtr32;
    PVOID Reserved9[45];
    BYTE Reserved10[96];
    PPS_POST_PROCESS_INIT_ROUTINE PostProcessInitRoutine;
    BYTE Reserved11[128];
    PVOID Reserved12[1];
    ULONG SessionId;
} PEB, *PPEB;

typedef struct _PROCESS_BASIC_INFORMATION {
    LONG ExitStatus;
    PPEB PebBaseAddress;
    ULONG_PTR AffinityMask;
    LONG BasePriority;
    ULONG_PTR UniqueProcessId;
    ULONG_PTR InheritedFromUniqueProcessId;
} PROCESS_BASIC_INFORMATION;

prc_result prc_get_process_command_line(void* process,
                                        uint16_t* out,
                                        size_t* outlen) {
  if (process == NULL || outlen == NULL) return prc_invalid_arg;
  HMODULE ntdll = LoadLibraryA("Ntdll.dll");
  if (ntdll == NULL) return prc_system_error;
  NtQueryInformationProcess_t NtQueryInformationProcess =
    (NtQueryInformationProcess_t) GetProcAddress(
      ntdll, "NtQueryInformationProcess");

  if (NtQueryInformationProcess == NULL) {
    DWORD err = prc_get_sys_err();
    FreeLibrary(ntdll);
    SetLastError(err);
    return prc_system_error;
  }

  PROCESS_BASIC_INFORMATION pbi;
  NtQueryInformationProcess(process, ProcessBasicInformation,
    &pbi, sizeof(pbi), NULL);
  FreeLibrary(ntdll);

  PEB pbe;
  ZeroMemory(&pbe, sizeof(pbe));
  if (!ReadProcessMemory(process, pbi.PebBaseAddress,
        &pbe, sizeof(pbe), NULL)) {
    return prc_system_error;
  }

  RTL_USER_PROCESS_PARAMETERS pp;
  ZeroMemory(&pp, sizeof(pp));
  if (!ReadProcessMemory(process, pbe.ProcessParameters,
        &pp, sizeof(pp), NULL)) {
    return prc_system_error;
  }

  if (out == NULL) {
    *outlen = pp.CommandLine.Length;
  } else {
    if (!ReadProcessMemory(process, pp.CommandLine.Buffer,
          out, *outlen, outlen)) {
      return prc_system_error;
    }
  }
  return prc_ok;
}

prc_result prc_get_process_command_line_by_name(const uint16_t* name,
                                                uint16_t* out,
                                                size_t* outlen) {
  uint32_t pid = 0;
  prc_result r = prc_get_process_id_by_name(name, &pid);
  if (r != prc_ok) return r;
  HANDLE process = OpenProcess(
    PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
  if (process == NULL) return prc_system_error;
  r = prc_get_process_command_line(process, out, outlen);
  CloseHandle(process);
  return r;
}

#else

#endif
