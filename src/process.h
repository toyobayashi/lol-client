#ifndef SRC_PROCESS_H_
#define SRC_PROCESS_H_

#ifdef PRC_BUILD_DLL
  #ifdef __GNUC__
    #define _PRC_EXPORT __attribute__((dllexport))
  #else
    #define _PRC_EXPORT __declspec(dllexport)
  #endif
#else
  #ifdef PRC_USE_DLL
    #ifdef __GNUC__
      #define _PRC_EXPORT __attribute__((dllimport))
    #else
      #define _PRC_EXPORT __declspec(dllimport)
    #endif
  #else
    #define _PRC_EXPORT
  #endif
#endif

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum prc_result {
  prc_ok,
  prc_invalid_arg,
  prc_process_not_found,
  prc_system_error,
  prc_not_supported
} prc_result;

_PRC_EXPORT const char* prc_err(prc_result code);
_PRC_EXPORT void prc_free_sys_err_msg(uint16_t* msg);
_PRC_EXPORT uint32_t prc_get_sys_err();
_PRC_EXPORT prc_result prc_get_sys_err_msg(uint16_t** msg);
_PRC_EXPORT prc_result prc_is_process_running(uint32_t pid, bool* out);
_PRC_EXPORT prc_result
prc_get_process_id_by_name(const uint16_t* name, uint32_t* pid);
_PRC_EXPORT prc_result
prc_get_process_command_line_by_name(const uint16_t* name,
                                     uint16_t* out,
                                     size_t* outlen);

#ifdef __cplusplus
}
#endif

#endif  // SRC_PROCESS_H_
