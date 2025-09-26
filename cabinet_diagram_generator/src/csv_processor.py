"""
CSV处理模块

负责CSV文件的读取、验证、格式转换和数据预处理。
"""

import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from loguru import logger

from .models import Device
from .config import CSVConfig, DEFAULT_CSV_CONFIG
from .utils import (
    validate_csv_file, detect_csv_format, parse_u_position, 
    parse_device_height, standardize_device_purpose, 
    validate_device_data, safe_get_value,
    DataValidationError, FileFormatError
)


class CSVProcessor:
    """CSV处理器类"""
    
    def __init__(self, config: Optional[CSVConfig] = None):
        """
        初始化CSV处理器
        
        Args:
            config: CSV配置对象
        """
        self.config = config or DEFAULT_CSV_CONFIG
        self.raw_data: Optional[pd.DataFrame] = None
        self.processed_data: List[Device] = []
        self.validation_errors: List[str] = []
        self.format_type: str = "unknown"
        
    def load_csv(self, file_path: str, encoding: Optional[str] = None) -> pd.DataFrame:
        """
        加载CSV文件
        
        Args:
            file_path: CSV文件路径
            encoding: 文件编码，如果为None则自动检测
            
        Returns:
            pandas DataFrame
            
        Raises:
            FileFormatError: 文件格式错误
        """
        logger.info(f"开始加载CSV文件: {file_path}")
        
        # 验证文件
        validate_csv_file(file_path)
        
        # 尝试不同编码读取文件
        encodings = [encoding] if encoding else ['utf-8', 'gbk', 'gb2312']
        
        for enc in encodings:
            try:
                df = pd.read_csv(
                    file_path,
                    encoding=enc,
                    sep=self.config.分隔符,
                    skip_blank_lines=self.config.跳过空行
                )
                logger.info(f"成功使用编码 {enc} 读取文件，共 {len(df)} 行数据")
                self.raw_data = df
                return df
            except UnicodeDecodeError:
                continue
            except Exception as e:
                logger.error(f"使用编码 {enc} 读取文件失败: {e}")
                continue
        
        raise FileFormatError(f"无法读取CSV文件，尝试的编码: {encodings}")
    
    def detect_format(self, df: Optional[pd.DataFrame] = None) -> str:
        """
        检测CSV格式
        
        Args:
            df: DataFrame，如果为None则使用已加载的数据
            
        Returns:
            格式类型: "new", "old", "unknown"
        """
        if df is None:
            df = self.raw_data
        
        if df is None:
            raise DataValidationError("没有可用的数据进行格式检测")
        
        self.format_type = detect_csv_format(df)
        logger.info(f"检测到CSV格式: {self.format_type}")
        return self.format_type
    
    def _is_empty_or_invalid_row(self, row: pd.Series, field_mapping: Dict[str, str]) -> Tuple[bool, str]:
        """
        检查行是否为空或关键字段缺失

        Args:
            row: 数据行
            field_mapping: 字段映射

        Returns:
            (是否跳过, 跳过原因)
        """
        # 检查是否为完全空行
        if row.isna().all() or (row == '').all():
            return True, "完全空行"

        # 检查关键字段是否为空
        critical_fields = ['机柜', 'U位']
        for orig_field, mapped_field in field_mapping.items():
            if mapped_field in critical_fields and orig_field in row.index:
                value = row[orig_field]
                if pd.isna(value) or str(value).strip() == '' or str(value).upper() == 'NAN':
                    return True, f"关键字段'{mapped_field}'为空"

        return False, ""

    def validate_data(self, df: Optional[pd.DataFrame] = None) -> List[str]:
        """
        验证数据完整性和有效性（跳过空行和无效行）

        Args:
            df: DataFrame，如果为None则使用已加载的数据

        Returns:
            错误信息列表
        """
        if df is None:
            df = self.raw_data

        if df is None:
            raise DataValidationError("没有可用的数据进行验证")

        errors = []
        skipped_rows = 0
        skipped_reasons = {}

        # 检查是否为空
        if df.empty:
            errors.append("CSV文件为空")
            return errors

        # 检测格式
        format_type = self.detect_format(df)
        if format_type == "unknown":
            errors.append("无法识别CSV格式，请检查列名是否正确")
            return errors

        # 获取字段映射
        field_mapping = self.config.get_field_mapping(format_type)

        # 检查必需字段
        missing_fields = []
        for required_field in self.config.必需字段:
            # 查找对应的原始字段名
            original_field = None
            for orig, mapped in field_mapping.items():
                if mapped == required_field and orig in df.columns:
                    original_field = orig
                    break

            if original_field is None:
                missing_fields.append(required_field)

        if missing_fields:
            errors.append(f"缺少必需字段: {', '.join(missing_fields)}")

        # 逐行验证数据（跳过空行和无效行）
        for index, row in df.iterrows():
            # 检查是否需要跳过此行
            should_skip, skip_reason = self._is_empty_or_invalid_row(row, field_mapping)
            if should_skip:
                skipped_rows += 1
                skipped_reasons[skip_reason] = skipped_reasons.get(skip_reason, 0) + 1
                logger.debug(f"跳过第{index + 1}行: {skip_reason}")
                continue

            # 验证有效行
            row_errors = self._validate_row(row, field_mapping, index + 1)
            errors.extend(row_errors)

        # 记录跳过的行统计
        if skipped_rows > 0:
            logger.info(f"跳过了 {skipped_rows} 行无效数据:")
            for reason, count in skipped_reasons.items():
                logger.info(f"  - {reason}: {count} 行")

        self.validation_errors = errors
        logger.info(f"数据验证完成，发现 {len(errors)} 个错误，跳过 {skipped_rows} 行")
        return errors
    
    def _validate_row(self, row: pd.Series, field_mapping: Dict[str, str], row_num: int) -> List[str]:
        """
        验证单行数据
        
        Args:
            row: 数据行
            field_mapping: 字段映射
            row_num: 行号
            
        Returns:
            错误信息列表
        """
        errors = []
        
        try:
            # 构建设备数据字典
            device_data = {}
            for orig_field, mapped_field in field_mapping.items():
                if orig_field in row.index:
                    device_data[mapped_field] = row[orig_field]
            
            # 添加默认值
            for field, default_value in self.config.默认值.items():
                if field not in device_data or pd.isna(device_data[field]):
                    device_data[field] = default_value
            
            # 验证设备数据
            device_errors = validate_device_data(device_data)
            for error in device_errors:
                errors.append(f"第{row_num}行: {error}")
                
        except Exception as e:
            errors.append(f"第{row_num}行: 数据处理异常 - {str(e)}")
        
        return errors
    
    def convert_to_devices(self, df: Optional[pd.DataFrame] = None) -> List[Device]:
        """
        将DataFrame转换为Device对象列表（跳过空行和无效行）

        Args:
            df: DataFrame，如果为None则使用已加载的数据

        Returns:
            Device对象列表

        Raises:
            DataValidationError: 数据验证失败
        """
        if df is None:
            df = self.raw_data

        if df is None:
            raise DataValidationError("没有可用的数据进行转换")

        # 验证数据（现在会跳过无效行，只对有效行报错）
        errors = self.validate_data(df)
        if errors:
            error_msg = "\n".join(errors[:10])  # 只显示前10个错误
            if len(errors) > 10:
                error_msg += f"\n... 还有 {len(errors) - 10} 个错误"
            raise DataValidationError(f"数据验证失败:\n{error_msg}")

        # 获取字段映射
        field_mapping = self.config.get_field_mapping(self.format_type)

        devices = []
        skipped_count = 0

        for index, row in df.iterrows():
            try:
                # 检查是否需要跳过此行
                should_skip, skip_reason = self._is_empty_or_invalid_row(row, field_mapping)
                if should_skip:
                    skipped_count += 1
                    logger.debug(f"转换时跳过第{index + 1}行: {skip_reason}")
                    continue

                # 转换有效行
                device = self._convert_row_to_device(row, field_mapping)
                devices.append(device)
            except Exception as e:
                logger.error(f"第{index + 1}行转换失败: {e}")
                skipped_count += 1
                continue

        self.processed_data = devices
        logger.info(f"成功转换 {len(devices)} 个设备，跳过 {skipped_count} 行无效数据")
        return devices
    
    def _convert_row_to_device(self, row: pd.Series, field_mapping: Dict[str, str]) -> Device:
        """
        将单行数据转换为Device对象
        
        Args:
            row: 数据行
            field_mapping: 字段映射
            
        Returns:
            Device对象
        """
        # 构建设备数据字典
        device_data = {}
        
        # 映射字段
        for orig_field, mapped_field in field_mapping.items():
            if orig_field in row.index:
                value = row[orig_field]
                if pd.notna(value):
                    device_data[mapped_field] = str(value).strip()
        
        # 添加默认值
        for field, default_value in self.config.默认值.items():
            if field not in device_data or not device_data[field]:
                device_data[field] = default_value
        
        # 数据类型转换和标准化
        try:
            # 解析U位
            device_data["U位"] = parse_u_position(device_data.get("U位", "1"))
            
            # 解析设备高度
            device_data["设备高度"] = parse_device_height(device_data.get("设备高度", "1"))
            
            # 标准化设备用途
            device_data["设备用途"] = standardize_device_purpose(device_data.get("设备用途", "其他"))
            
            # 处理机柜字段（兼容旧格式的"机柜号"）
            if "机柜" not in device_data and "机柜号" in device_data:
                device_data["机柜"] = device_data["机柜号"]
            
        except Exception as e:
            raise DataValidationError(f"数据转换失败: {e}")
        
        # 创建Device对象
        return Device(
            资产编号=safe_get_value(device_data, "资产编号", ""),
            区域=safe_get_value(device_data, "区域", self.config.默认值["区域"]),
            子区=safe_get_value(device_data, "子区", self.config.默认值["子区"]),
            设备用途=safe_get_value(device_data, "设备用途", "其他"),
            设备名=safe_get_value(device_data, "设备名", ""),
            型号=safe_get_value(device_data, "型号", ""),
            设备高度=device_data["设备高度"],
            机房=safe_get_value(device_data, "机房", self.config.默认值["机房"]),
            机柜=safe_get_value(device_data, "机柜", ""),
            U位=device_data["U位"],
            厂商=safe_get_value(device_data, "厂商", self.config.默认值["厂商"])
        )
    
    def process_file(self, file_path: str, encoding: Optional[str] = None) -> List[Device]:
        """
        处理CSV文件的完整流程
        
        Args:
            file_path: CSV文件路径
            encoding: 文件编码
            
        Returns:
            Device对象列表
        """
        logger.info(f"开始处理CSV文件: {file_path}")
        
        # 加载文件
        df = self.load_csv(file_path, encoding)
        
        # 转换为设备对象
        devices = self.convert_to_devices(df)
        
        logger.info(f"CSV文件处理完成，共处理 {len(devices)} 个设备")
        return devices
    
    def get_processing_summary(self) -> Dict[str, Any]:
        """
        获取处理摘要信息
        
        Returns:
            处理摘要字典
        """
        summary = {
            "文件信息": {
                "原始行数": len(self.raw_data) if self.raw_data is not None else 0,
                "处理设备数": len(self.processed_data),
                "格式类型": self.format_type
            },
            "验证结果": {
                "错误数量": len(self.validation_errors),
                "错误列表": self.validation_errors[:5]  # 只显示前5个错误
            }
        }
        
        if self.processed_data:
            # 统计信息
            rooms = set(device.机房 for device in self.processed_data)
            cabinets = set(device.full_location for device in self.processed_data)
            purposes = set(device.设备用途 for device in self.processed_data)
            
            summary["统计信息"] = {
                "机房数量": len(rooms),
                "机柜数量": len(cabinets),
                "设备用途种类": len(purposes),
                "机房列表": sorted(list(rooms)),
                "设备用途列表": sorted(list(purposes))
            }
        
        return summary
