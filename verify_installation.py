#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
安装验证脚本

验证Office转PDF工具的安装和基本功能
"""

import sys
import tempfile
from pathlib import Path


def test_imports():
    """测试包导入"""
    print("🔍 测试包导入...")
    try:
        import office2pdf
        from office2pdf import OfficeConverter, config
        from office2pdf.utils import find_office_files, validate_input_path
        print("✅ 所有包导入成功")
        print(f"   版本: {office2pdf.__version__}")
        return True
    except ImportError as e:
        print(f"❌ 包导入失败: {e}")
        return False


def test_dependencies():
    """测试依赖包"""
    print("\n🔍 测试依赖包...")
    dependencies = {
        'pandas': 'pandas',
        'openpyxl': 'openpyxl', 
        'python-docx': 'docx',
        'python-pptx': 'pptx',
        'python-dotenv': 'dotenv'
    }
    
    success = True
    for name, module in dependencies.items():
        try:
            __import__(module)
            print(f"✅ {name}: 导入成功")
        except ImportError:
            print(f"❌ {name}: 导入失败")
            success = False
    
    return success


def test_system_requirements():
    """测试系统要求"""
    print("\n🔍 测试系统要求...")
    
    from office2pdf import config
    
    # 检查LibreOffice
    libreoffice_cmd = config.get_libreoffice_command()
    if libreoffice_cmd:
        print(f"✅ LibreOffice: {libreoffice_cmd}")
    else:
        print("❌ LibreOffice: 未找到")
        return False
    
    # 验证配置
    validation_results = config.validate_config()
    all_valid = True
    for key, value in validation_results.items():
        status = "✅" if value else "❌"
        print(f"{status} {key}: {value}")
        if not value:
            all_valid = False
    
    return all_valid


def test_basic_functionality():
    """测试基本功能"""
    print("\n🔍 测试基本功能...")
    
    try:
        from office2pdf import OfficeConverter
        from office2pdf.utils import find_office_files
        
        # 测试转换器初始化
        converter = OfficeConverter()
        print("✅ 转换器初始化成功")
        
        # 测试文件格式检查
        test_files = {
            'test.docx': True,
            'test.xlsx': True, 
            'test.pptx': True,
            'test.txt': False,
            'test.pdf': False
        }
        
        for filename, expected in test_files.items():
            result = converter._is_supported_file(Path(filename))
            if result == expected:
                status = "✅"
            else:
                status = "❌"
            print(f"{status} 文件格式检查 {filename}: {result}")
        
        # 测试文件发现
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # 创建测试文件
            test_files = ['doc1.docx', 'sheet1.xlsx', 'pres1.pptx', 'text1.txt', '~$temp.docx']
            for filename in test_files:
                (temp_path / filename).touch()
            
            # 查找Office文件
            office_files = list(find_office_files(temp_path))
            expected_count = 3  # docx, xlsx, pptx (不包括txt和临时文件)
            
            if len(office_files) == expected_count:
                print(f"✅ 文件发现功能: 找到{len(office_files)}个Office文件")
            else:
                print(f"❌ 文件发现功能: 期望{expected_count}个，实际{len(office_files)}个")
                return False
        
        return True
        
    except Exception as e:
        print(f"❌ 基本功能测试失败: {e}")
        return False


def test_code_quality():
    """测试代码质量"""
    print("\n🔍 测试代码质量...")
    
    try:
        import subprocess
        
        # 检查Ruff
        result = subprocess.run(['ruff', 'check', 'office2pdf/'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Ruff代码检查: 通过")
        else:
            print("⚠️  Ruff代码检查: 有警告")
            print(f"   {result.stdout.strip()}")
        
        return True
        
    except Exception as e:
        print(f"❌ 代码质量检查失败: {e}")
        return False


def main():
    """主函数"""
    print("🚀 Office转PDF工具安装验证")
    print("=" * 50)
    
    tests = [
        ("包导入", test_imports),
        ("依赖包", test_dependencies), 
        ("系统要求", test_system_requirements),
        ("基本功能", test_basic_functionality),
        ("代码质量", test_code_quality)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name}测试异常: {e}")
            results.append((test_name, False))
    
    # 总结
    print("\n" + "=" * 50)
    print("📊 验证结果总结:")
    
    passed = 0
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"   {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n总计: {passed}/{len(results)} 项测试通过")
    
    if passed == len(results):
        print("🎉 所有测试通过！项目安装和配置正确。")
        return 0
    else:
        print("⚠️  部分测试失败，请检查配置。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
