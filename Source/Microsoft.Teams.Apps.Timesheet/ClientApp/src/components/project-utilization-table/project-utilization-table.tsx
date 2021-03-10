// <copyright file="project-utilization-table.tsx" company="Microsoft Corporation">
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// </copyright>

import * as React from "react";
import Constants, { ModelType } from "../../constants/constants";
import { Flex, Status, Text, Checkbox, Button, Table, Avatar, Loader } from '@fluentui/react-northstar';
import { CloseIcon, QuestionCircleIcon, TrashCanIcon } from '@fluentui/react-icons-northstar';
import { Icon } from 'office-ui-fabric-react';
import { WithTranslation, withTranslation } from "react-i18next";
import { TFunction } from "i18next";
import IProjectMemberOverview from "../../models/project-member-overview";
import IProjectTaskOverview from "../../models/project-task-overview";

import "./project-utilization-table.scss";

interface IProjectUtilizationTableProps extends WithTranslation {
    onRemove: (selectedItems: Array<any>, modelType: ModelType) => void;
    onSelectAllItemCheckedChange: (modelType: ModelType, isAllItemsSelected: boolean) => void;
    onItemCheckedChange: (selectedItem: any, modelType: ModelType) => void;
    onAddActionClick: () => void;
    tableDetails: Array<any>;
    tableOptions: ModelType;
    isLoading: boolean;
}

/**
 * Renders the projects card for the user.
 * @param props The props of type IDashboardProjectsProps.
 */
const ProjectUtilizationTable: React.FunctionComponent<IProjectUtilizationTableProps> = props => {
    const localize: TFunction = props.t;
    const [isAllItemsSelected, setAllItemsSelected] = React.useState(false);

    React.useEffect(() => {
        manageControlsEnabilityAndSelection();
    }, [props.tableDetails]);

    /**
     * Renders action for users table/list.
     */
    const renderAction = () => {
        let selectedItems = props.tableDetails.filter((tableDetail: any) => tableDetail.isSelected === true);
        let action = <Flex.Item push >
            <div className="manage-project-action">
                {selectedItems.length > 0
                    ? <Button text icon={<TrashCanIcon className="action-icon" />} content={localize("removeSelected")} onClick={removeSelectedItems} />
                    : <Button text icon={props.tableOptions === ModelType.Member ? <Icon className="action-icon" iconName="AddFriend" /> : <Icon className="action-icon" iconName="Org" />} content={props.tableOptions == ModelType.Member ? localize("addPeople") : localize("addTasksLabel")} data-tid={props.tableOptions == ModelType.Member ? "addMemberButton" : "addTaskButton"} onClick={onAddActionClick} />}
            </div>
        </Flex.Item>;
        return action;
    };

    /**
     * Handles when user click on add task/member
     */
    const onAddActionClick = () => {
        props.onAddActionClick();
    };

    /**
     * Remove selected items from the table .
     */
    const removeSelectedItems = () => {
        let items = props.tableDetails;
        let itemsSelected = items.filter((item: any) => item.isSelected);
        props.onRemove(itemsSelected, props.tableOptions);
    };

    /**
     * Manages 'Remove' button's enability and manages select all checked state 
     */
    const manageControlsEnabilityAndSelection = () => {
        let itemsCount = props.tableDetails.filter((tableDetail: any) => tableDetail.isSelected === true)?.length;
        let isAllItemsSelected = itemsCount === props.tableDetails.length;
        setAllItemsSelected(isAllItemsSelected);
    };

    /** 
     *  The event handler called when select all checked state changed 
     */
    const onSelectAllItemCheckedChange = () => {
        if (props.tableDetails) {
            props.onSelectAllItemCheckedChange(props.tableOptions, isAllItemsSelected);
            manageControlsEnabilityAndSelection();
        }
    };

    /**
     * The event handler called when any items checked state changed
     * @param selectedItems The selected item's details
     */
    const onItemCheckedChange = (selectedItem: any) => {
        props.onItemCheckedChange(selectedItem, props.tableOptions);
        manageControlsEnabilityAndSelection();
    };

    /** 
     * Return error message 
     */
    const getNotFoundError = (tableOption: any) => {
        return (<Flex className="manage-request-content" gap="gap.small">
            <Flex.Item>
                <div className="error-container">
                    <QuestionCircleIcon outline color="green" />
                </div>
            </Flex.Item>
            <Flex.Item grow>
                <Flex column gap="gap.small" vAlign="stretch">
                    <div>
                        {tableOption === ModelType.Member && <Text weight="bold" content={localize("timesheetRequestNotAvailableHeaderDescription")} />}
                        {tableOption === ModelType.Task && <Text weight="bold" content={localize("taskNotAvailableHeaderDescription")} />}
                        <br />
                    </div>
                </Flex>
            </Flex.Item>
        </Flex>);
    };

    /**
     * Gets the status of the user
     * @param userRequests The selected userRequests details
     */
    const getUserStatus = (userRequests: IProjectMemberOverview) => {
        if (userRequests) {
            if (userRequests.isBillable) {
                return localize("billable");
            }
            else {
                return localize("nonBillable");
            }
        }
    };

    /** 
     * Get members table 
     */
    const getMembersTable = () => {
        let userRequests = props.tableDetails;
        if (props.isLoading) {
            return <Loader />;
        }

        if (userRequests?.length > 0) {
            const timesheetRequestTableHeaderItems = {
                key: "header",
                items: [
                    {
                        content: <Checkbox checked={isAllItemsSelected} onChange={onSelectAllItemCheckedChange} />,
                        design: { minWidth: "10vw", maxWidth: "10vw" }
                    },
                    {
                        content: localize("employee"),
                        design: { minWidth: "33vw", maxWidth: "33vw" }
                    },
                    {
                        content: localize("totalWorkHours"),
                        design: { minWidth: "20vw", maxWidth: "20vw" }
                    },
                    {
                        content: localize("status"),
                        design: { minWidth: "20vw", maxWidth: "20vw" }
                    },
                ]
            };

            let rows = userRequests.map((userRequest: IProjectMemberOverview, index: number) => {
                return {
                    "key": index,
                    "items": [
                        {
                            content: <Checkbox key={index} checked={userRequest.isSelected} onChange={() => onItemCheckedChange(userRequest)} />,
                            design: { minWidth: "10vw", maxWidth: "10vw" }
                        },
                        {
                            content:
                                <Flex vAlign="center" gap="gap.small">
                                    {userRequest.isBillable && <Status className="status-web-bullets" color={Constants.billableStatusColor} title={localize("billable")} />}
                                    {!userRequest.isBillable && <Status className="status-web-bullets" color={Constants.nonBillableStatusColor} title={localize("nonBillable")} />}
                                    <Avatar name={userRequest.userName} />
                                    <Text className="table-text" content={userRequest.userName} />

                                </Flex>,
                            title: userRequest.userName,
                            truncateContent: true,
                            design: { minWidth: "33vw", maxWidth: "33vw" }
                        },
                        {
                            content: <Text className="table-text" content={userRequest.totalHours} />,
                            title: userRequest.totalHours,
                            truncateContent: true,
                            design: { minWidth: "20vw", maxWidth: "20vw" }
                        },
                        {
                            content: <Text className="table-text" content={getUserStatus(userRequest)} />,
                            title: getUserStatus(userRequest),
                            truncateContent: true,
                            design: { minWidth: "20vw", maxWidth: "20vw" }
                        },
                        {
                            content: <CloseIcon outline className="close-button" data-tid={`remove-member-${index}`} onClick={() => props.onRemove([userRequest], props.tableOptions)} />,
                            title: localize("closeIconLabel"),
                            truncateContent: true,
                            design: { minWidth: "10vw", maxWidth: "10vw" }
                        }
                    ]
                };
            });

            return (
                <Table
                    data-tid="member-table"
                    header={timesheetRequestTableHeaderItems}
                    rows={rows}
                />
            );
        }
        else {
            return getNotFoundError(ModelType.Member);
        }
    };

    /**
     * Get task table 
     */
    const getTasksTable = () => {
        let tasks = props.tableDetails;
        if (props.isLoading) {
            return <Loader />;
        }

        if (tasks?.length > 0) {
            const tasksTableHeaderItems = {
                key: "header",
                items: [
                    {
                        content: <Checkbox checked={isAllItemsSelected} onChange={onSelectAllItemCheckedChange} />,
                        design: { minWidth: "10vw", maxWidth: "10vw" }
                    },
                    {
                        content: localize("taskNameLabel"),
                        design: { minWidth: "30vw", maxWidth: "30vw" }
                    },
                    {
                        content: localize("totalHourWorkedLabel"),
                        design: { minWidth: "30vw", maxWidth: "30vw" }
                    },
                ]
            };

            let rows = tasks.map((task: IProjectTaskOverview, index: number) => {
                return {
                    "key": index,
                    "items": [
                        {
                            content: <Checkbox key={index} checked={task.isSelected} onChange={() => onItemCheckedChange(task)} />,
                            design: { minWidth: "10vw", maxWidth: "10vw" }
                        },
                        {
                            content: <Text className="table-text" content={task.title} />,
                            title: task.title,
                            truncateContent: true,
                            design: { minWidth: "30vw", maxWidth: "30vw" }
                        },
                        {
                            content: <Text className="table-text" content={task.totalHours} />,
                            title: task.totalHours,
                            truncateContent: true,
                            design: { minWidth: "30vw", maxWidth: "30vw" }
                        },
                        {
                            content: <CloseIcon outline className="close-button" data-tid={`remove-task-${index}`} onClick={() => props.onRemove([task], props.tableOptions)} />,
                            title: localize("closeIconLabel"),
                            truncateContent: true,
                            design: { minWidth: "20vw", maxWidth: "20vw" }
                        }
                    ]
                };
            });

            return (
                <Table
                    data-tid="task-table"
                    header={tasksTableHeaderItems}
                    rows={rows}
                />
            );
        }
        else {
            return getNotFoundError(ModelType.Task);
        }
    };

    /** 
     * Renders table according to table option 
     */
    const renderTable = () => {
        switch (props.tableOptions) {
            case ModelType.Member:
                return getMembersTable();

            case ModelType.Task:
                return getTasksTable();
        }
    };

    /**
     * Render project utilization table
     */
    const renderBody = () => {
        let body = <div className="utilization-table-container">
            <Flex vAlign="center">
                {renderAction()}
            </Flex>
            {renderTable()}
        </div>;
        return <div>{body}</div>;
    };

    return (
        <div>{renderBody()}</div>
    );
};

export default withTranslation()(ProjectUtilizationTable);