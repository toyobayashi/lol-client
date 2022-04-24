{
  "variables": {
    "module_name": "process",
    "module_path": "./dist"
  },
  'targets': [
    {
      'target_name': '<(module_name)',
      'sources': [
        'src/binding.c',
        'src/addon.c',
        'src/process.c',
      ],
      'conditions': [
        ['OS=="win"', { 
          'msvs_settings': {
            'VCCLCompilerTool': {
              'AdditionalOptions': ['/source-charset:utf-8']
            },
          },
          'defines':[
            'NOMINMAX'
          ],
          'libraries': []
        }]
      ]
      # 'includes': [
      #   './common.gypi'
      # ],
    },
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": [ "<(module_name)" ],
      "copies": [
        {
          "files": [ "<(PRODUCT_DIR)/<(module_name).node" ],
          "destination": "<(module_path)"
        }
      ]
    }
  ]
}
