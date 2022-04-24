#include <stdlib.h>
#include <string.h>

#include "addon.h"
#include "process.h"

#define NAPI_CALL(env, call)                                      \
  do {                                                            \
    napi_status status = (call);                                  \
    if (status != napi_ok) {                                      \
      const napi_extended_error_info* error_info = NULL;          \
      napi_get_last_error_info((env), &error_info);               \
      const char* err_message = error_info->error_message;        \
      bool is_pending;                                            \
      napi_is_exception_pending((env), &is_pending);              \
      if (!is_pending) {                                          \
        const char* message = (err_message == NULL)               \
            ? "empty error message"                               \
            : err_message;                                        \
        napi_throw_error((env), NULL, message);                   \
        return NULL;                                              \
      }                                                           \
    }                                                             \
  } while (0)

#define NAPI_EXPORT_FUNCTION(env, exports, name, fn)        \
  do {                                                      \
    napi_value js_##fn;                                     \
    NAPI_CALL((env), napi_create_function((env),            \
                                          (name),           \
                                          NAPI_AUTO_LENGTH, \
                                          (fn),             \
                                          NULL,             \
                                          &js_##fn));       \
    NAPI_CALL((env), napi_set_named_property((env),         \
                                             (exports),     \
                                             (name),        \
                                             js_##fn));     \
  } while (0)

#define PRC_THROW(env, prc_r)                                                \
  do {                                                                       \
    if ((prc_r) == prc_system_error) {                                       \
      char16_t* msg = NULL;                                                  \
      uint32_t errcode = prc_get_sys_err();                                  \
      prc_get_sys_err_msg(&msg);                                             \
      napi_value js_msg;                                                     \
      napi_status s = napi_create_string_utf16(                              \
        (env), msg, NAPI_AUTO_LENGTH, &js_msg);                              \
      prc_free_sys_err_msg(msg);                                             \
      if (s != napi_ok) {                                                    \
        napi_throw_error((env), NULL, "napi_create_string_utf16 failed");    \
        return NULL;                                                         \
      }                                                                      \
      napi_value error;                                                      \
      napi_value code;                                                       \
      NAPI_CALL((env), napi_create_uint32((env), errcode, &code));           \
      NAPI_CALL((env), napi_create_error((env), NULL, js_msg, &error));      \
      NAPI_CALL((env), napi_set_named_property((env), error, "code", code)); \
      NAPI_CALL((env), napi_throw((env), error));                            \
      return NULL;                                                           \
    }                                                                        \
    NAPI_CALL((env), napi_throw_error((env), NULL, prc_err(prc_r)));         \
    return NULL;                                                             \
  } while (0)

static
napi_value is_process_running(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value js_pid;
  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, &js_pid, NULL, NULL));
  uint32_t pid;
  NAPI_CALL(env, napi_get_value_uint32(env, js_pid, &pid));
  bool running = false;
  prc_result r = prc_is_process_running(pid, &running);
  if (r != prc_ok) {
    PRC_THROW(env, r);
  }
  napi_value js_ret;
  NAPI_CALL(env, napi_get_boolean(env, running, &js_ret));
  return js_ret;
}

static
napi_value get_process_id(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value js_exe;
  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, &js_exe, NULL, NULL));
  size_t len_exclude_null = 0;
  NAPI_CALL(env, napi_get_value_string_utf16(env,
                                             js_exe,
                                             NULL,
                                             0,
                                             &len_exclude_null));

  size_t len = (len_exclude_null + 1) * sizeof(char16_t);
  char16_t* exe = (char16_t*) malloc(len);  // NOLINT
  if (!exe) return NULL;
  napi_status s = napi_get_value_string_utf16(env,
                                              js_exe,
                                              exe,
                                              len,
                                              &len_exclude_null);

  if (s != napi_ok) {
    const napi_extended_error_info* error_info = NULL;
    napi_get_last_error_info((env), &error_info);
    const char* err_message = error_info->error_message;
    bool is_pending;
    napi_is_exception_pending(env, &is_pending);
    if (!is_pending) {
      const char* message = (err_message == NULL)
          ? "empty error message"
          : err_message;
      free(exe);
      napi_throw_error(env, NULL, message);
      return NULL;
    }
  }

  uint32_t pid;
  prc_result r = prc_get_process_id_by_name(exe, &pid);
  free(exe);
  if (r != prc_ok) {
    PRC_THROW(env, r);
  }

  napi_value ret;
  NAPI_CALL(env, napi_create_uint32(env, pid, &ret));
  return ret;
}

static
napi_value get_process_command_line(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value js_exe;
  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, &js_exe, NULL, NULL));
  size_t len_exclude_null = 0;
  NAPI_CALL(env, napi_get_value_string_utf16(env,
                                             js_exe,
                                             NULL,
                                             0,
                                             &len_exclude_null));

  size_t len = (len_exclude_null + 1) * sizeof(char16_t);
  char16_t* exe = (char16_t*) malloc(len);  // NOLINT
  if (!exe) return NULL;
  napi_status s = napi_get_value_string_utf16(env,
                                              js_exe,
                                              exe,
                                              len,
                                              &len_exclude_null);

  if (s != napi_ok) {
    const napi_extended_error_info* error_info = NULL;
    napi_get_last_error_info((env), &error_info);
    const char* err_message = error_info->error_message;
    bool is_pending;
    napi_is_exception_pending(env, &is_pending);
    if (!is_pending) {
      const char* message = (err_message == NULL)
          ? "empty error message"
          : err_message;
      free(exe);
      napi_throw_error(env, NULL, message);
      return NULL;
    }
  }
  len = 0;
  prc_result r = prc_get_process_command_line_by_name(exe, NULL, &len);
  if (r != prc_ok) {
    free(exe);
    PRC_THROW(env, r);
  }

  char16_t* cmd = (char16_t*) malloc(len);  // NOLINT
  memset(cmd, 0, len);
  r = prc_get_process_command_line_by_name(exe, cmd, &len);
  free(exe);
  if (r != prc_ok) {
    free(cmd);
    PRC_THROW(env, r);
  }

  napi_value ret;
  NAPI_CALL(env, napi_create_string_utf16(env,
    cmd, len / sizeof(char16_t), &ret));
  free(cmd);

  return ret;
}

napi_value create_addon(napi_env env, napi_value exports) {
  napi_value true_value;
  NAPI_CALL(env, napi_get_boolean(env, true, &true_value));
  napi_property_descriptor properties = {
    "__esModule", NULL, NULL, NULL, NULL, true_value, napi_default, NULL
  };
  NAPI_CALL(env, napi_define_properties(env, exports, 1, &properties));

  NAPI_EXPORT_FUNCTION(env, exports,
    "getProcessId", get_process_id);
  NAPI_EXPORT_FUNCTION(env, exports,
    "getProcessCommandLine", get_process_command_line);
  NAPI_EXPORT_FUNCTION(env, exports,
    "isProcessRunning", is_process_running);

  return exports;
}
